import { useState, type FormEvent } from 'react'
import { signIn, type SignInResult } from '../data/auth'
import './RecordForm.css' // 카드·입력 칸·아래 큰 버튼 모양을 기록 입력 화면과 같이 쓴다
import './Login.css'

interface Props {
  onLoggedIn: () => void
}

const ERROR_TEXT: Record<Exclude<SignInResult, 'ok'>, string> = {
  wrong: '이메일이나 비밀번호가 맞지 않아요',
  offline: '인터넷이 되는 곳에서 로그인해 주세요',
  failed: '로그인하지 못했어요. 잠시 뒤 다시 눌러 주세요',
}

/**
 * 로그인 화면. 앱을 설치하고 처음 한 번만 본다.
 * 가입 화면은 없다: 계정은 개발자가 Supabase 화면에서 만들어 드린다
 */
export default function Login({ onLoggedIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await signIn(email, password)
    if (result === 'ok') {
      onLoggedIn()
      return
    }
    setError(ERROR_TEXT[result])
    setBusy(false)
  }

  return (
    <main className="record-form login">
      <header className="page-header">
        <h1>부추 하우스</h1>
        <p className="login-lead">처음 한 번만 로그인하면 돼요</p>
      </header>

      <form onSubmit={handleSubmit}>
        <section className="form-card">
          <label className="field-label" htmlFor="login-email">
            이메일
          </label>
          <input
            id="login-email"
            className="text-input"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none" // 폰이 첫 글자를 대문자로 바꾸지 않게
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="field-label" htmlFor="login-password">
            비밀번호
          </label>
          <input
            id="login-password"
            className="text-input"
            type="password"
            autoComplete="current-password" // 폰이 저장해 둔 비밀번호를 채워 줄 수 있게
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </section>

        <div className="save-bar">
          {error !== null && <p className="field-error">{error}</p>}
          <button type="submit" className="save" disabled={busy || email.trim() === '' || password === ''}>
            {busy ? '로그인 중…' : '로그인'}
          </button>
        </div>
      </form>
    </main>
  )
}
