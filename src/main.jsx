import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { CATEGORIES, STATUSES, filterRequests, validateRequest, errorMessage } from './model.js';
import './styles.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(url && key && !url.includes('YOUR_PROJECT'));
const supabase = configured ? createClient(url, key) : null;
const date = value => new Intl.DateTimeFormat('ru', { dateStyle: 'medium' }).format(new Date(value));
const blankDraft = () => ({ id: crypto.randomUUID(), title: '', description: '', category: '', status: 'Новая' });

function Auth() {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice('');
    try {
      const result = register
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (register && !result.data.session) {
        setNotice('Проверьте почту: если регистрация доступна, придёт письмо с подтверждением. После подтверждения войдите.');
        setPassword(''); setRegister(false);
      }
    } catch (error) { setNotice(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="auth-layout">
    <section className="intro"><span className="eyebrow">LD LATTE</span>
      <h1>Меньше рутины.{' '}<br />Больше времени{' '}<br />на приоритеты.</h1>
      <p>Заявки на автоматизацию в одном месте.<br />Опишите задачу, следите за статусом и возвращайтесь к деталям.</p>
      <span className="intro-note">Ваши заявки доступны только вам.</span>
    </section>
    <section className="auth-card"><span className="eyebrow">ЗАЯВКИ НА АВТОМАТИЗАЦИЮ</span>
      <h2>{register ? 'Создать аккаунт' : 'Добро пожаловать'}</h2>
      <p>{register ? 'Зарегистрируйтесь по рабочей почте.' : 'Войдите, чтобы продолжить работу.'}</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
        <label>Пароль<input type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
        {register && <small>Не менее 6 символов.</small>}
        {notice && <p className="notice" role="status">{notice}</p>}
        <button className="primary full" disabled={busy}>{busy ? 'Подождите…' : register ? 'Зарегистрироваться' : 'Войти'}</button>
      </form>
      <button className="text-button" disabled={busy} onClick={() => { setRegister(!register); setNotice(''); setPassword(''); }}>{register ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}</button>
    </section>
  </main>;
}

export function Workspace({ user, client = supabase }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const saveLock = useRef(false);
  const titleRef = useRef(null);

  async function load() {
    setLoading(true); setLoadError('');
    try {
      const { data, error } = await client.from('requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setRequests(data);
    } catch (error) { setLoadError(errorMessage(error)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (editor) titleRef.current?.focus(); }, [editor]);

  function open(request) {
    setEditor(request ? 'edit' : 'create'); setDraft(request ? { ...request } : blankDraft());
    setFormError(''); setNotice('');
  }
  function change(field, value) { setDraft(current => ({ ...current, [field]: value })); }
  async function save(event) {
    event.preventDefault();
    if (saveLock.current) return;
    const validation = validateRequest(draft);
    if (validation) { setFormError(validation); return; }
    saveLock.current = true; setBusy(true); setFormError(''); setNotice('');
    try {
      const fields = { title: draft.title.trim(), description: draft.description.trim(), category: draft.category };
      const query = editor === 'create'
        ? client.from('requests').insert({ ...fields, id: draft.id, user_id: user.id })
        : client.from('requests').update({ ...fields, status: draft.status }).eq('id', draft.id);
      const { data, error } = await query.select().single();
      if (error) throw error;
      setRequests(current => editor === 'create' ? [data, ...current] : current.map(item => item.id === data.id ? data : item));
      setNotice(editor === 'create' ? 'Заявка создана.' : 'Изменения сохранены.');
      setEditor(null); setDraft(null);
    } catch (error) { setFormError(errorMessage(error)); }
    finally { saveLock.current = false; setBusy(false); }
  }
  async function logout() {
    if (loggingOut || busy) return;
    setLoggingOut(true);
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setLoggingOut(false); }
  }
  const visible = filterRequests(requests, search, status);
  return <>
    <header className="topbar"><a className="brand" href="/">LD LATTE<span>Автоматизация</span></a>
      <div className="account"><span title={user.email}>{user.email}</span><button className="secondary" disabled={busy || loggingOut} onClick={logout}>{loggingOut ? 'Выходим…' : 'Выйти'}</button></div>
    </header>
    <main className="workspace">
      <div className="page-heading"><div><span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span><h1>Мои заявки</h1><p>Идеи, которые помогут освободить время.</p></div>
        {!editor && <button className="primary" onClick={() => open(null)}>+ Создать заявку</button>}
      </div>
      {notice && <p className="notice success" role="status">{notice}</p>}
      {editor ? <section className="panel editor"><div className="section-heading"><h2>{editor === 'create' ? 'Новая заявка' : 'Детали заявки'}</h2><button className="text-button" disabled={busy} onClick={() => { setEditor(null); setDraft(null); }}>К списку</button></div>
        {editor === 'edit' && <p className="muted">Создана {date(draft.created_at)}</p>}
        <form onSubmit={save} aria-busy={busy}>
          <fieldset disabled={busy}><label>Название <span className="required">*</span><input ref={titleRef} required value={draft.title} onChange={e => change('title', e.target.value)} placeholder="Например, отчёт о продажах" /></label>
            <label>Описание <span className="required">*</span><textarea required rows={6} value={draft.description} onChange={e => change('description', e.target.value)} placeholder="Что сейчас делаете вручную и какой результат нужен?" /></label>
            <div className="form-row"><label>Категория <span className="required">*</span><select required value={draft.category} onChange={e => change('category', e.target.value)}><option value="" disabled>Выберите категорию</option>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select></label>
              <label>Статус{editor === 'edit' ? <select value={draft.status} onChange={e => change('status', e.target.value)}>{STATUSES.map(item => <option key={item}>{item}</option>)}</select> : <input value="Новая" readOnly />}</label></div>
          </fieldset>
          {formError && <p className="notice error" role="alert">{formError}</p>}
          <div className="form-actions"><button className="primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button><button type="button" className="secondary" disabled={busy} onClick={() => { setEditor(null); setDraft(null); }}>Отмена</button></div>
        </form>
      </section> : <>
        <section className="filters" aria-label="Поиск и фильтр"><label>Поиск по названию<input type="search" placeholder="Найти заявку…" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Статус<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Все статусы</option>{STATUSES.map(item => <option key={item}>{item}</option>)}</select></label></section>
        <section className="panel" aria-label="Список заявок" aria-busy={loading}>
          <div className="section-heading"><h2>Заявки <span className="count">{visible.length}</span></h2><button className="text-button" disabled={loading} onClick={load}>Обновить</button></div>
          {loading ? <p className="empty" role="status">Загружаем заявки…</p> : loadError ? <p className="notice error" role="alert">{loadError}</p> : !visible.length ? <div className="empty"><h3>{requests.length ? 'Ничего не найдено' : 'Здесь появятся ваши заявки'}</h3><p>{requests.length ? 'Попробуйте другой запрос или статус.' : 'Создайте первую заявку и опишите, что нужно автоматизировать.'}</p></div> :
            <ul className="request-list">{visible.map(request => <li key={request.id}><button className="request" onClick={() => open(request)}><div className="request-content"><h3>{request.title}</h3><div className="request-meta"><span>{request.category}</span><time dateTime={request.created_at}>{date(request.created_at)}</time></div></div><span className={`badge status-${STATUSES.indexOf(request.status)}`}>{request.status}</span><span className="open-label">Открыть</span></button></li>)}</ul>}
        </section>
      </>}
      <footer>LD LATTE · Заявки на автоматизацию</footer>
    </main>
  </>;
}

function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setReady(true); }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) { setSession(data.session); setSessionError(Boolean(error)); setReady(true); }
    }).catch(() => { if (active) { setSessionError(true); setReady(true); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  if (!configured) return <main className="configuration panel"><h1>Нужно подключить Supabase</h1><p>Укажите адрес проекта и клиентский publishable/anon key в переменных окружения по инструкции README.</p></main>;
  if (!ready) return <main className="configuration" role="status">Загружаем рабочее пространство…</main>;
  if (sessionError && !session) return <main className="configuration panel"><p role="alert">Не удалось восстановить вход. Обновите страницу и попробуйте снова.</p><button className="primary" onClick={() => location.reload()}>Обновить</button></main>;
  return session ? <Workspace key={session.user.id} user={session.user} /> : <Auth />;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
