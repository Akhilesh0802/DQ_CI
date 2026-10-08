# Data Quality Tool - Updated Package

## NAYA: Phase 1 + Phase 2 gaps band (new versions, one-upload-lock, cancel, Celery + Redis)

**Phase 1**
- **New version upload**: har dataset row par "New version" (system/period wahi rehte hain). API: `POST /datasets/{id}/versions`.
  Table mein `v1`, `v2`... dikhta hai; details modal mein **Versions** tab (har version ka View / Log / Excel report).
  Admin kisi bhi dataset ka version daal sakta hai.
- **Ek user = ek active upload**: jab tak aapka pichla upload Queued/Running hai, naya upload 409 deta hai (friendly message,
  button disabled). Alag-alag users ek saath upload kar sakte hain. Same user ke 2 requests bilkul ek saath aayein toh DB ka
  partial unique index (`uq_one_active_version_per_user`) doosre ko rok deta hai - startup par apne aap ban jata hai.
- **Cancel**: Queued/Running job par "Cancel" (owner ya admin). Job agle checkpoint par ruk jata hai, adhoora result hat jata hai.
- **Atke hue jobs** (worker crash, waise): `ACTIVE_UPLOAD_STALE_MINUTES` (default 60) ke baad failed mark ho jate hain,
  taaki user hamesha ke liye block na ho. Server start par bhi saaf hote hain.
- Sirf `.csv` / `.xlsx` accept hoti hai; corrupt file par 400 (500 nahi).
- Security: API response se server ka `storage_path` hata diya.

**Phase 2: Celery + Redis**
- `USE_CELERY=False` (default) = pehle jaisa BackgroundTasks, Redis ki zaroorat nahi.
- `USE_CELERY=True` = jobs Redis queue se Celery worker uthata hai. Redis down ho toh upload fail nahi hota, apne aap
  BackgroundTasks par fallback ho jata hai. `GET /health` batata hai: job_runner, redis up/down, kitne workers sun rahe hain.
- Job idempotent hai: worker crash ke baad task dobara aaye toh duplicate results nahi bante.
- Speed fix: date-format detection ab pehle 1000-value ke sample par chalta hai (100k rows: ~9.5s -> ~1.5s).

### Celery + Redis (OPTIONAL - normal use mein zaroorat nahi)
App Docker ke bina aur Redis ke bina poori chalti hai (`USE_CELERY=False`, default). Celery tabhi lagana jab
bahut saare users ek saath upload karein aur alag worker chahiye. Tab:
1. Redis server chalao (Docker nahi): Windows par Memurai ya WSL mein `sudo apt install redis-server && redis-server`,
   ya company ka koi Redis server (URL manager se pucho).
2. `backend/.env` mein:  `USE_CELERY=True`  (aur `REDIS_URL=redis://localhost:6379/0`)
3. Terminal 1 (backend/, venv active):  `python -m uvicorn app.main:app --reload`
4. Terminal 2 (backend/, venv active):  `celery -A app.worker.celery_app worker --loglevel=info --pool=threads --concurrency=4`
5. Terminal 3: `cd frontend` then `npm run dev`
6. Check: `http://localhost:8000/health` -> `"job_runner":"celery","redis":"up","workers":1`
Kuch bhi atke toh `.env` mein `USE_CELERY=False` karke API restart - app pehle jaisi chalegi.

**Dhyan do:** Celery 5.6 officially Python 3.13 tak listed hai; mera test Python 3.12 (Linux) par hua hai. Tumhara Python 3.14
(Windows) par worker untested hai. Agar worker start/chalne mein dikkat aaye toh woh error bhejo.
Windows par `--pool=threads` hi use karo (default prefork Windows par nahi chalta; `--pool=solo` ek time pe ek hi job chalata hai).

---

## NAYA: Admin ke liye full visibility

- **Owner column** (username + user id) dashboard par - sirf admin ko dikhta hai.
- **Running / Done / Failed filter** (counts ke saath). Status labels: Queued, Running..., Done, Failed.
  Running jobs ke liye list apne aap har 2 second mein refresh hoti hai.
- **Log download** ab har status par (running aur failed job ka bhi, jitna ab tak bana) - owner ko apna,
  admin ko sabka.
- Admin sabka dataset dekh sakta hai: details, Excel report, PDF summary, log.
- **/admin/audit** (navbar: "Audit trail", sirf admin): kisne, kab, kya kiya - user id ke saath, filter box ke saath.
  API: `GET /audit-logs/?limit=500`.
- Fix: "Uploaded" time pehle ~5.5 ghante galat dikhta tha (UTC ko local maan leta tha). Ab sahi.

---

## NAYA: Configurable rules (Phase 2)

Sirf wahi 3 rules jo pehle code mein the - koi naya rule nahi joda:

| Rule | Default | Severity |
|---|---|---|
| Missing values | column mein > 5% | warning |
| Duplicate rows | > 0 rows | error |
| Format mismatch | >= 80% values numeric/date/boolean, baaki match nahi | warning |

- Admin ke liye naya page: **/admin/rules** (navbar mein "Rules" link, sirf admin ko dikhta hai).
  Har rule ka threshold, severity, on/off aur "skip columns" badal sakta hai; "Reset to default" se code
  wali value wapas.
- Settings DB table `rule_configs` mein (create_all khud bana dega). Row nahi hai toh code ke defaults lagte hain
  (`backend/app/services/rules_config.py`).
- API: `GET /rules/` (koi bhi logged-in user), `PUT /rules/{key}` aur `DELETE /rules/{key}` (sirf admin, audit log mein jaata hai).
- Badlav sirf **naye uploads** par lagta hai. Har profiling ke process log mein likha hota hai kaunse rules lage the.
- Frontend: `components/RuleEditor.tsx`, `admin/rules/page.tsx`.

---

## NAYA (Phase 2 reference code ke hisaab se)

Snowflake SP `SP_AUTO_DATA_METRICS` + Python wrapper ka logic pandas mein port kiya:

- `backend/app/services/column_profiler.py` (naya) - type inference
  (BOOLEAN -> NUMERIC -> DATE -> TEXT, reference wala order), date format detection
  (DD/MM vs MM/DD, year 1900-2100 check, strict rule: saari non-null values conform karein),
  aur per-type metrics (numeric / date / text / boolean - wahi metric names).
- **Format validation** (spec ka missing point): jis column ki >=80% values numeric/date/boolean
  hain par kuch nahi, wahan warning aati hai ("N values don't match numeric format in 'col'").
  Reference mein `DATA_ERROR_COUNT` hardcoded 0 tha - yahan asli implement hai.
- `ColumnMetric` table (naya, `create_all` khud bana dega) - har column ka type + metrics.
- **Backend Excel report**: `GET /datasets/versions/{id}/report` - sheets: Summary, Numeric, Date,
  Text, Boolean, Issues. (Pehle Excel browser mein banta tha.)
- Frontend: naya **Column Metrics** tab, "Download Excel report" backend se.
- Profiling steps ab process log mein: read_file, completeness_check, duplicate_check,
  uniqueness_check, type_inference_and_metrics, rule_evaluation, complete.
- Security: `next` 16.3.4 -> 16.3.8 (critical advisory), aur `xlsx` package hata diya (ab use nahi hota).

**Purane uploads:** Column Metrics tab khali dikhega (metrics tab bane jab upload hua tha) - dobara upload karo.

**Reference se abhi NAHI liya:** per-table execution lock (`DATA_METRICS_STATUS`/`ENTRY_LOG`),
PDF report via reportlab, configurable rules. (Rules abhi bhi code mein fixed hain.)

---


Maine tumhare uploaded zip ka poora code padha, ek real bug fix kiya, aur ye naye
features add kiye: **forgot password (email OTP, free)**, **phone number field**,
aur **real log download** (pehle sirf frontend placeholder tha). Sab kuch khud
end-to-end test karke confirm kiya hai — details neeche.

## Kya naya/fix hua hai (is version mein)

1. **Bug fix — profiling hamesha "processing" pe atak jaता thа**: agar upload
   ki hui file mein koi numeric column poора khali ho (sab values missing),
   uska average/min/max `NaN` (Not-a-Number) aata hai, aur PostgreSQL ka JSON
   column `NaN` accept nahi karta — isliye poора background job silently crash
   ho jाता thа, status kabhi "done"/"failed" nahi hota tha. Ab `NaN` ko `null`
   (JSON None) mein convert karte hain, aur poора profiling function ek
   defensive `try/except` mein hai jo terminal mein poора error print karता
   hai agar kuch aur bhi fail ho — kabhi silent crash nahi hoگा ab.
2. **Password show/hide (eye icon)** — login, register, aur forgot-password
   teenों forms mein add kiya.
3. **`email-validator` requirements.txt mein add kiya** — pehле isके bina
   install karте waqt error aata tha (`ImportError: email-validator is not
   installed`), ab permanently fix hai.
4. **Audit trail activate kiya** — `audit_logs` table pehле se bani thi
   lekin koई endpoint use nahi karta thа. Ab register, login, forgot-password,
   reset-password, upload, aur log-download — sab actions record hote hain
   (kaun, kab, kya). `GET /audit-logs/` (sirf admin) se dekh sakte ho.
5. **SQL query logging** — har database query ek alag file (`backend/logs/sql_queries.log`)
   mein likhi jाती hai, terminal saaf rehta hai. `.env` mein `SQL_ECHO=False`
   karके band kar sakte ho (production mein performance ke liye better hota hai).

## Kya naya/fix hua hai (pichли version se)

1. **Forgot password (FREE version)** — email + OTP se. Abhi ke liye OTP
   backend ke terminal mein print hota hai (real email bhejne ke liye baad
   mein Gmail SMTP add kar sakte ho, `app/services/otp_service.py` mein
   sirf ek function badalna hoga).
2. **Phone number** — register form mein add hua, `users` table mein bhi.
3. **Real log download** — pehle `backend/app/routers/logs.py` bilkul khali
   tha (0 lines). Ab `GET /datasets/versions/{id}/log` se asli processing
   log milta hai (jo `ProcessLog` table mein pehle se store ho raha tha,
   bas usko nikalne wala endpoint nahi tha).
4. **Bug fix** — `GET /datasets/` list mein `status`/`record_count` fields
   nahi aa rahe the (schema bana tha but router use nahi kar raha tha). Fix
   kar diya.
5. **Frontend ko modular files mein split kiya** — pehle `dashboard/page.tsx`
   515 lines ki ek file thi. Ab:
   - `app/lib/types.ts` — saare shared TypeScript types
   - `app/lib/api.ts` — saari backend API calls ek jagah
   - `app/components/UploadModal.tsx` — upload form + progress bar
   - `app/components/DatasetsTable.tsx` — dataset list table
   - `app/components/DetailsModal.tsx` — quality issues + summary download
   - `app/components/ChatPanel.tsx` — AI chat (abhi mock, Phase 3 mein real hoga)
   - `app/dashboard/page.tsx` — ab sirf inhi sabko jodta hai, chhota sa

## Maine khud test kiya (backend)

20 automated checks likhe aur chalaye — register (phone ke saath), login,
forgot-password → OTP → reset-password → naye password se login, upload →
background profiling → null counts/duplicates/issues, ownership isolation
(Priya/Rohit ek doosre ka data nahi dekh sakte), role permissions (viewer
upload nahi kar sakta), log download. **Sab 20 pass hue.**

## Maine khud test kiya (frontend)

`next build` chalake confirm kiya — koi TypeScript/JSX error nahi, saare
pages (`/login`, `/register`, `/dashboard`, `/forgot-password`) successfully
compile hote hain. Dono servers (backend + frontend) actual chalake bhi
dekha — sab pages 200 return karte hain.

## Setup (agar fresh se karna ho)

### Backend
```
cd backend
python -m venv venv
venv\Scripts\Activate.ps1        (Windows PowerShell)
pip install -r requirements.txt
copy .env.example .env           (phir .env mein apna DATABASE_URL/SECRET_KEY daalo)
uvicorn app.main:app --reload
```

### Frontend
```
cd frontend
npm install
npm run dev
```

### Test karne ka order
1. `/register` — naya user banao (phone bhi bharo)
2. `/login` — login karo
3. Dashboard pe dataset upload karo
4. Kuch second wait karo (processing background mein hota hai)
5. "View" click karke quality issues dekho
6. Log/Excel/PDF download try karo
7. Logout karke `/forgot-password` try karo — OTP backend ke terminal mein
   dikhega, wahi copy karke reset karo

## Ek cheez jo abhi bhi baaki hai

Concurrency lock (agar same user 2 uploads ek saath try kare) wala poora
design pehle bana tha ek alag document mein — wo implement nahi hua abhi.
Jab chaho tab bata dena.

## Audit trail dekhne ka tareeka

Swagger docs (`/docs`) mein `GET /audit-logs/` try karo (admin token ke
saath "Authorize" karke) - sab users ke actions dikhenge (register, login,
upload, download, waise) with exact datetime. Frontend mein iska koi page
abhi nahi banaya - agar chahiye ho, bata dena.

SQL query log dekhne ke liye: `backend/logs/sql_queries.log` file kholo
(backend chalane ke baad automatically banegi).
