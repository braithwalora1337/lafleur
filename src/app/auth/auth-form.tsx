"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createAuthClient } from "@/lib/supabase/auth-client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [registered, setRegistered] = useState(false);
  const enteredPhoneDigits = phone.replace(/\D/g, "");
  const phoneValid = (enteredPhoneDigits.length === 10 && enteredPhoneDigits.startsWith("9")) || (enteredPhoneDigits.length === 11 && (enteredPhoneDigits.startsWith("7") || enteredPhoneDigits.startsWith("8")));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const db = createAuthClient();
      if (signup) {
        let phoneDigits = phone.replace(/\D/g, "");
        if (phoneDigits.length === 10 && phoneDigits.startsWith("9")) phoneDigits = `7${phoneDigits}`;
        if (phoneDigits.startsWith("8") && phoneDigits.length === 11) phoneDigits = `7${phoneDigits.slice(1)}`;
        if (phoneDigits.length !== 11 || !phoneDigits.startsWith("7")) throw new Error("Введите корректный номер телефона");
        const normalizedPhone = `+${phoneDigits}`;
        const { data, error } = await db.auth.signUp({ email, password, options: { data: { name: name.trim(), phone: normalizedPhone }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (error) throw error;
        if (data.session) setRegistered(true);
        else setMessage("Проверьте почту — мы отправили ссылку для подтверждения.");
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось выполнить вход");
    } finally {
      setBusy(false);
    }
  }

  async function googleLogin() {
    setBusy(true);
    setMessage("");
    try {
      const db = createAuthClient();
      const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Вход через Google пока недоступен");
      setBusy(false);
    }
  }

  return <div className="auth-shell">
    <section className="auth-visual"><Link className="brand" href="/">LA<span>FLEUR</span></Link><div><span className="eyebrow">Личный кабинет</span><h1>{signup ? "Сохраняйте важные моменты" : "Рады видеть вас снова"}</h1><p>История заказов, сохранённые данные и любимые букеты — в одном месте.</p></div><small>Цветы как личное послание</small></section>
    <section className="auth-panel"><Link className="auth-close" href="/" aria-label="Вернуться в магазин">×</Link><div className="auth-box"><span className="eyebrow">LaFleur account</span><h2>{signup ? "Создать аккаунт" : "Войти в аккаунт"}</h2><p>{signup ? "Заполните данные — это займёт меньше минуты." : "Войдите, чтобы продолжить покупки."}</p><button className="google-button" type="button" onClick={() => void googleLogin()} disabled={busy}><b>G</b> Продолжить с Google</button><div className="auth-divider"><span>или через email</span></div><form className="auth-form" onSubmit={submit}>{signup && <><label>Имя<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Анна" /></label><label>Телефон <small>обязательное поле</small><input className={phoneTouched && !phoneValid ? "field-invalid" : ""} required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} onBlur={() => setPhoneTouched(true)} placeholder="+7 999 000-00-00" title="Введите российский номер телефона" />{phoneTouched && !phoneValid && <em className="field-error">Введите полный номер: 10 цифр после +7</em>}</label></>}<label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.ru" /></label><label>Пароль<input required minLength={8} type="password" autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не менее 8 символов" /></label>{message && <p className="auth-message">{message}</p>}<button className="button auth-submit" disabled={busy || (signup && !phoneValid)}>{busy ? "Подождите…" : signup ? "Зарегистрироваться" : "Войти"}</button></form><p className="auth-switch">{signup ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"} <Link href={signup ? "/auth/login" : "/auth/signup"}>{signup ? "Войти" : "Зарегистрироваться"}</Link></p></div></section>
    {registered && <div className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title"><div className="registration-card"><div className="registration-mark">✓</div><span className="eyebrow">Добро пожаловать в LaFleur</span><h2 id="registration-title">Регистрация пройдена</h2><p>Аккаунт успешно создан. Сохраните данные для следующего входа:</p><dl><div><dt>Имя</dt><dd>{name}</dd></div><div><dt>Логин</dt><dd>{email}</dd></div><div><dt>Телефон</dt><dd>{phone}</dd></div><div><dt>Пароль</dt><dd className="saved-password">{password}</dd></div></dl><small>Можно сделать скриншот этой карточки. Не отправляйте его посторонним.</small><button className="button" onClick={() => { setRegistered(false); router.replace("/"); router.refresh(); }}>Понятно, продолжить</button></div></div>}
  </div>;
}
