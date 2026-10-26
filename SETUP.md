ITX SHOP PRO — SETUP GUIDE (বাংলা)
===================================

এই ZIP একটি full-stack starter: HTML/CSS/JS frontend + Supabase Auth + Postgres/RLS.
এটি নিজে থেকে কোনো Supabase project তৈরি করে না; credentials যোগ ও SQL চালানো আবশ্যক।

A) Supabase project
1. Supabase.com-এ account খুলে project তৈরি করুন।
2. Project Settings → API (বা Connect) থেকে Project URL এবং anon/publishable key কপি করুন।
3. config.js-এ SUPABASE_URL ও SUPABASE_ANON_KEY বসান।
   IMPORTANT: service_role/secret key কখনো config.js বা browser code-এ দেবেন না।
4. Supabase SQL Editor-এ supabase.sql-এর সম্পূর্ণ কোড রান করুন।
5. Authentication → URL Configuration-এ আপনার GitHub Pages/site URL যোগ করুন।
6. Authentication email confirmation চালু থাকলে registration-এর পর email confirm করতে হবে।

B) প্রথম Admin
1. ওয়েবসাইট থেকে নিজের account তৈরি করুন এবং email verify/login করুন।
2. Supabase Dashboard → Authentication → Users থেকে ওই user-এর UUID কপি করুন।
3. SQL Editor-এ নিচের কমান্ড চালান, UUID বদলে নিজের UUID দিন:
   update public.profiles set role = 'admin' where id = 'PASTE_AUTH_USER_UUID_HERE';
4. Logout করে আবার login করুন। Admin panel খুলবে।
   সাধারণ user-এর role frontend থেকে admin করা যায় না; role পরিবর্তন project owner-এর SQL action।

C) Free hosting (GitHub Pages)
1. GitHub-এ public repository তৈরি করুন।
2. index.html, style.css, config.js, app.js, supabase.sql এবং SETUP.md আপলোড করুন।
3. Repository Settings → Pages → Deploy from a branch → main / root → Save।
4. প্রকাশিত URL Supabase Authentication URL Configuration-এ যুক্ত করুন।
5. GitHub Pages static hosting; backend/database Supabase-এ থাকবে। Free tier limits/pauses/quotas পরিবর্তিত হতে পারে—চালুর আগে বর্তমান pricing/limits যাচাই করুন।

D) Payment setup
- COD অর্ডার সরাসরি pending order হিসেবে তৈরি হয়।
- বিকাশ/নগদ পদ্ধতিতে customer Transaction ID/reference দেয়; order payment_status=verification_required হয়।
- এই starter কোনো payment API দিয়ে টাকা নেয় না এবং reference স্বয়ংক্রিয়ভাবে যাচাই করে না।
- বাস্তব বিকাশ/নগদ automatic payment চাইলে merchant account ও official payment gateway/API integration প্রয়োজন। পেমেন্ট নম্বর যাচাই করে তারপর paid mark করুন।
- Checkout-এ দোকানের আসল payment instructions/merchant number প্রকাশ করার আগে নিজের merchant details বসান।

E) গুরুত্বপূর্ণ production checklist
- Supabase RLS policies SQL-এ চালানো আছে; public client-এর জন্য শুধু anon/publishable key ব্যবহার করুন।
- Admin role শুধু trusted SQL/dashboard থেকে assign করুন।
- Email confirmation, strong passwords, rate limiting/abuse controls ও backups configure করুন।
- Order cancellation/refund/stock restoration workflow production-এর আগে যোগ করুন।
- বর্তমানে customer order history UI, shipping fee calculation, product image upload/storage, automatic SMS, refund workflows এবং payment gateway নেই।
- Payment reference, phone, address ব্যক্তিগত তথ্য; access সীমিত রাখুন এবং প্রয়োজনীয় privacy notice দিন।
- `place_order` RPC DB price থেকে মোট হিসাব করে; client পাঠানো price বিশ্বাস করে না।
- Public live site-এ চালুর আগে test project-এ end-to-end পরীক্ষা করুন।

Files:
- index.html: storefront
- style.css: responsive styling
- config.js: Supabase URL + public anon key
- app.js: auth, product listing, cart, checkout, admin actions
- supabase.sql: database tables, RLS, order RPC
- SETUP.md: এই নির্দেশনা
