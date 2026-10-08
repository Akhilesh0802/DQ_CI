"""
Column-level profiling engine.

Reference: Snowflake SP_AUTO_DATA_METRICS (Phase 2 reference code). Same logic, pandas mein:
  - Type inference order: BOOLEAN -> NUMERIC -> DATE -> TEXT
  - Date format detection across common formats (DD/MM vs MM/DD ambiguity handled)
  - Strict rule: koi column tabhi NUMERIC/DATE/BOOLEAN hai jab uski SAARI non-null values conform karein
  - Per-type metrics (numeric / date / text / boolean)

Extra (reference mein placeholder tha, yahan implement): TEXT columns ke liye
data_error_count - agar column ki >=80% values kisi type (numeric/date/boolean)
se match karti hain par kuch nahi, toh wo "format error" hai.
"""
import math
from datetime import date, datetime

import numpy as np
import pandas as pd

BOOLEAN_TRUE = {"TRUE", "YES", "1", "T", "Y"}
BOOLEAN_FALSE = {"FALSE", "NO", "0", "F", "N"}
BOOLEAN_ALL = BOOLEAN_TRUE | BOOLEAN_FALSE

FORMAT_ERROR_THRESHOLD = 0.8  # itni values match karein toh baaki ko "format error" maano

# Speed: date format detection pehle SAMPLE_SIZE unique values par ~70 formats try karta hai; jo format sample ki
# PRUNE_RATIO se kam values parse kare, use poore data par chalate hi nahi. (Bina iske lakhon unique text values
# wale column par har format poora chalta tha - 100k rows par ~4 sec per column.)
SAMPLE_SIZE = 1000
PRUNE_RATIO = 0.2

MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"]
DAY_NAMES_SUN_FIRST = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def _build_date_formats():
    # (format, counterpart) - counterpart = day/month swapped version (ambiguity check ke liye)
    # DD formats MM se pehle - tie hone par DD jeetta hai (reference jaisa)
    base = []
    for sep in ["-", "/", "."]:
        dd_mm = f"%d{sep}%m{sep}%Y"
        mm_dd = f"%m{sep}%d{sep}%Y"
        base += [(dd_mm, mm_dd), (mm_dd, dd_mm), (f"%Y{sep}%m{sep}%d", None), (f"%Y{sep}%d{sep}%m", None)]
    numeric_sep_formats = list(base)  # time variants sirf inke liye
    base += [
        ("%d-%b-%Y", None), ("%b-%d-%Y", None), ("%Y-%b-%d", None),
        ("%d-%B-%Y", None), ("%B-%d-%Y", None),
        ("%Y%m%d", None), ("%d%m%Y", "%m%d%Y"), ("%m%d%Y", "%d%m%Y"),
        ("%d %b %Y", None), ("%b %d %Y", None), ("%Y %b %d", None),
        ("%Y %m %d", None), ("%d %m %Y", None), ("%m %d %Y", None),
    ]
    with_time = []
    for fmt, counterpart in numeric_sep_formats:
        for suffix in (" %H:%M:%S", " %H:%M"):
            with_time.append((fmt + suffix, counterpart + suffix if counterpart else None))
    with_time += [("%d-%b-%Y %H:%M:%S", None), ("%b-%d-%Y %H:%M:%S", None), ("%Y-%b-%d %H:%M:%S", None)]
    return base + with_time


DATE_FORMATS = _build_date_formats()

# (key, label) - report/UI mein isi order mein dikhta hai
METRIC_DEFS = {
    "NUMERIC": [
        ("total_records", "# of Records"), ("net_value", "Net Value"), ("absolute_value", "Absolute Value"),
        ("no_of_zeros", "# of Zero Items"), ("total_positive_value", "Positive Value"),
        ("total_negative_value", "Negative Value"), ("positive_value_count", "# of Positive Records"),
        ("negative_value_count", "# of Negative Records"), ("null_value_count", "# of Null Values"),
        ("non_null_value_count", "# of Valid Values"), ("average_value", "Average Value"),
        ("minimum_value", "Minimum Value"), ("maximum_value", "Maximum Value"),
        ("min_value_count", "Record # of Min"), ("max_value_count", "Record # of Max"),
    ],
    "DATE": [
        ("total_records", "# of Records"), ("non_null_value_count", "# of Valid Values"),
        ("null_value_count", "# of Null Values"), ("earliest_date", "Earliest Date"),
        ("latest_date", "Latest Date"), ("earliest_date_count", "Record # of Earliest"),
        ("latest_date_count", "Record # of Latest"), ("most_common_day", "Most Common Day"),
        ("most_common_month", "Most Common Month"),
    ] + [(f"items_in_{m.lower()}", f"Items in {m}") for m in MONTH_NAMES]
      + [(f"items_on_{d.lower()}", f"Items on {d}") for d in DAY_NAMES_SUN_FIRST],
    "TEXT": [
        ("total_records", "# of Records"), ("non_null_value_count", "# of Valid Values"),
        ("null_value_count", "# of Null Values"), ("empty_string_count", "# of Empty Strings"),
        ("distinct_value_count", "# of Distinct Values"), ("min_length", "Minimum Length"),
        ("max_length", "Maximum Length"), ("average_length", "Average Length"),
        ("most_common_value", "Most Common Value"), ("least_common_value", "Least Common Value"),
        ("data_error_count", "# of Format Errors"),
    ],
    "BOOLEAN": [
        ("total_records", "# of Records"), ("true_count", "# of True Values"),
        ("false_count", "# of False Values"), ("null_value_count", "# of Null Values"),
        ("non_null_value_count", "# of Valid Values"), ("percentage_true", "% True"),
        ("percentage_false", "% False"),
    ],
}


# ---------------------------------------------------------------- helpers

def json_safe(obj):
    """NaN/inf/numpy/Timestamp ko JSON-safe banata hai (Postgres JSON NaN accept nahi karta)."""
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_safe(v) for v in obj]
    if obj is None or isinstance(obj, (str, bool)):
        return obj
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        value = float(obj)
        return value if math.isfinite(value) else None
    if obj is pd.NaT:
        return None
    if isinstance(obj, (pd.Timestamp, datetime, date)):
        return obj.strftime("%Y-%m-%d")
    try:
        return None if pd.isna(obj) else str(obj)
    except (TypeError, ValueError):
        return str(obj)


def _present_strings(series: pd.Series) -> pd.Series:
    """Non-null, non-blank values (trimmed strings)."""
    present = series.dropna().astype(str).str.strip()
    return present[present != ""]


def _to_numeric_present(present: pd.Series) -> pd.Series:
    cleaned = present.str.replace(r'[,"]', "", regex=True)
    nums = pd.to_numeric(cleaned, errors="coerce")
    return nums.where(np.isfinite(nums))


def _valid_dates(values: pd.Series, fmt: str) -> pd.Series:
    parsed = pd.to_datetime(values, format=fmt, errors="coerce")
    in_range = parsed.dt.year.between(1900, 2100)  # year range validation (reference jaisa)
    return parsed.where(in_range)


def detect_date_format(present: pd.Series):
    """Best-matching date format dhundta hai. Returns (format, valid_count_over_present)."""
    if present.empty:
        return None, 0
    counts = present.value_counts()
    uniques = pd.Series(counts.index)

    # Stage 1: sample par saare formats - jo bilkul match nahi karte unhe hata do
    sample = uniques if len(uniques) <= SAMPLE_SIZE else uniques.sample(SAMPLE_SIZE, random_state=0)
    candidates = [
        (fmt, counterpart) for fmt, counterpart in DATE_FORMATS
        if _valid_dates(sample, fmt).notna().mean() >= PRUNE_RATIO
    ]

    # Stage 2: bache hue formats poore data par
    best_fmt, best_key = None, (-1, -1)
    for fmt, counterpart in candidates:
        valid_u = _valid_dates(uniques, fmt).notna()
        fmt_count = int(counts[uniques[valid_u]].sum()) if valid_u.any() else 0
        if fmt_count == 0:
            continue
        if counterpart:
            other_valid = _valid_dates(uniques, counterpart).notna()
            exclusive_u = valid_u & ~other_valid
            exclusive = int(counts[uniques[exclusive_u]].sum()) if exclusive_u.any() else 0
        else:
            exclusive = fmt_count
        key = (fmt_count, exclusive)
        if key > best_key:
            best_fmt, best_key = fmt, key
    return best_fmt, max(best_key[0], 0)


def _numeric_values(series: pd.Series) -> pd.Series:
    """Poori length ki Series; non-numeric/null rows NaN."""
    out = pd.Series(np.nan, index=series.index, dtype="float64")
    present = _present_strings(series)
    if not present.empty:
        out.loc[present.index] = _to_numeric_present(present)
    return out


def _date_values(series: pd.Series, fmt: str) -> pd.Series:
    out = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")
    present = _present_strings(series)
    if not present.empty:
        out.loc[present.index] = _valid_dates(present, fmt)
    return out


# ---------------------------------------------------------------- metric builders

def _numeric_metrics(series: pd.Series) -> dict:
    valid = _numeric_values(series).dropna()
    non_null = int(valid.size)
    min_v = float(valid.min()) if non_null else None
    max_v = float(valid.max()) if non_null else None
    return {
        "total_records": int(len(series)),
        "net_value": round(float(valid.sum()), 2) if non_null else None,
        "absolute_value": round(float(valid.abs().sum()), 2) if non_null else None,
        "no_of_zeros": int((valid == 0).sum()),
        "total_positive_value": round(float(valid[valid > 0].sum()), 2) if non_null else None,
        "total_negative_value": round(float(valid[valid < 0].sum()), 2) if non_null else None,
        "positive_value_count": int((valid > 0).sum()),
        "negative_value_count": int((valid < 0).sum()),
        "null_value_count": int(len(series) - non_null),
        "non_null_value_count": non_null,
        "average_value": round(float(valid.mean()), 2) if non_null else None,
        "minimum_value": round(min_v, 2) if min_v is not None else None,
        "maximum_value": round(max_v, 2) if max_v is not None else None,
        "min_value_count": int((valid == min_v).sum()) if non_null else 0,
        "max_value_count": int((valid == max_v).sum()) if non_null else 0,
    }


def _date_metrics(series: pd.Series, fmt: str) -> dict:
    valid = _date_values(series, fmt).dropna()
    non_null = int(valid.size)
    metrics = {
        "total_records": int(len(series)),
        "non_null_value_count": non_null,
        "null_value_count": int(len(series) - non_null),
        "earliest_date": valid.min() if non_null else None,
        "latest_date": valid.max() if non_null else None,
        "earliest_date_count": int((valid == valid.min()).sum()) if non_null else 0,
        "latest_date_count": int((valid == valid.max()).sum()) if non_null else 0,
        "most_common_day": valid.dt.day_name().value_counts().idxmax() if non_null else None,
        "most_common_month": valid.dt.month_name().value_counts().idxmax() if non_null else None,
    }
    month_counts = valid.dt.month.value_counts()
    for i, name in enumerate(MONTH_NAMES, start=1):
        metrics[f"items_in_{name.lower()}"] = int(month_counts.get(i, 0))
    dow_counts = valid.dt.dayofweek.value_counts()  # pandas: Monday=0 ... Sunday=6
    for idx, name in enumerate(DAY_NAMES_SUN_FIRST):
        pandas_dow = (idx - 1) % 7
        metrics[f"items_on_{name.lower()}"] = int(dow_counts.get(pandas_dow, 0))
    return metrics


def _boolean_metrics(series: pd.Series) -> dict:
    non_null_mask = series.notna()
    upper = series[non_null_mask].astype(str).str.strip().str.upper()
    true_count = int(upper.isin(BOOLEAN_TRUE).sum())
    false_count = int(upper.isin(BOOLEAN_FALSE).sum())
    non_null = int(non_null_mask.sum())
    return {
        "total_records": int(len(series)),
        "true_count": true_count,
        "false_count": false_count,
        "null_value_count": int(len(series) - non_null),
        "non_null_value_count": non_null,
        "percentage_true": round(true_count * 100.0 / non_null, 2) if non_null else 0,
        "percentage_false": round(false_count * 100.0 / non_null, 2) if non_null else 0,
    }


def _text_metrics(series: pd.Series, data_error_count: int) -> dict:
    non_null = series.dropna().astype(str)
    lengths = non_null.str.len()
    meaningful = non_null[non_null.str.strip() != ""]
    value_counts = meaningful.value_counts()
    return {
        "total_records": int(len(series)),
        "non_null_value_count": int(non_null.size),
        "null_value_count": int(len(series) - non_null.size),
        "empty_string_count": int((non_null.str.strip() == "").sum()),
        "distinct_value_count": int(series.fillna("<NULL>").astype(str).nunique()),
        "min_length": int(lengths.min()) if non_null.size else None,
        "max_length": int(lengths.max()) if non_null.size else None,
        "average_length": round(float(lengths.mean()), 2) if non_null.size else None,
        "most_common_value": value_counts.index[0] if not value_counts.empty else None,
        "least_common_value": value_counts.index[-1] if not value_counts.empty else None,
        "data_error_count": int(data_error_count),
    }


# ---------------------------------------------------------------- public API

def profile_column(name, series: pd.Series, format_threshold: float = FORMAT_ERROR_THRESHOLD) -> dict:
    present = _present_strings(series)
    nn = int(present.size)

    num_count = int(_to_numeric_present(present).notna().sum()) if nn else 0
    bool_count = int(present.str.upper().isin(BOOLEAN_ALL).sum()) if nn else 0

    fmt, date_count = None, 0
    # Reference order: boolean/numeric pehle check hote hain, unke liye date detect ki zaroorat nahi
    if nn and num_count < nn and bool_count < nn:
        fmt, date_count = detect_date_format(present)

    if nn and bool_count >= nn and num_count < nn:
        inferred = "BOOLEAN"
    elif nn and num_count >= nn:
        inferred = "NUMERIC"
    elif nn and fmt and date_count >= nn:
        inferred = "DATE"
    else:
        inferred = "TEXT"

    expected_type, error_count = None, 0
    if inferred == "TEXT" and nn:
        candidates = {"NUMERIC": num_count, "BOOLEAN": bool_count, "DATE": date_count}
        best_type = max(candidates, key=candidates.get)
        if candidates[best_type] / nn >= format_threshold:
            expected_type, error_count = best_type, nn - candidates[best_type]

    if inferred == "NUMERIC":
        metrics = _numeric_metrics(series)
    elif inferred == "DATE":
        metrics = _date_metrics(series, fmt)
    elif inferred == "BOOLEAN":
        metrics = _boolean_metrics(series)
    else:
        metrics = _text_metrics(series, error_count)

    return {
        "column_name": str(name),
        "inferred_type": inferred,
        "detected_format": fmt if inferred == "DATE" else None,
        "expected_type": expected_type,
        "metrics": json_safe(metrics),
    }


def profile_dataframe(df: pd.DataFrame, format_threshold: float = FORMAT_ERROR_THRESHOLD) -> list:
    return [profile_column(col, df[col], format_threshold) for col in df.columns]
