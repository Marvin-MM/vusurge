import { flushOutbox } from './outbox-flush'
import type { TestApp } from './test-app'

/**
 * End-to-end authentication helpers.
 *
 * These drive Better Auth's own HTTP endpoints exactly as a real client
 * would — sign up, read the verification link from the captured outbound
 * email, verify, sign in — rather than reaching into the database to
 * fabricate a session. That is what makes the resulting tests genuine
 * coverage of the mounted auth handler, not just of the business logic
 * behind it.
 */

export interface TestUser {
  readonly email: string
  readonly password: string
  readonly name: string
  readonly userId: string
  /** Cookie header value for subsequent authenticated requests. */
  readonly cookie: string
}

function cookieHeaderFrom(response: Response): string {
  const setCookies = response.headers.getSetCookie()
  return setCookies.map((entry) => entry.split(';')[0]).join('; ')
}

/** Sign up a new user. The account is unverified and has no session yet. */
export async function signUp(
  app: TestApp,
  input: { email: string; password: string; name: string },
): Promise<{ userId: string }> {
  const response = await app.request<{ user: { id: string } }>(
    'POST',
    '/api/v1/auth/sign-up/email',
    {
      body: input,
    },
  )
  if (response.status !== 200) {
    throw new Error(`Sign-up failed (${response.status}): ${JSON.stringify(response.body)}`)
  }
  return { userId: response.body.user.id }
}

/** Extract the verification URL Better Auth sent and complete verification. */
export async function verifyEmail(app: TestApp, email: string): Promise<void> {
  if (app.infrastructure.fakeEmail.latestTo(email) === undefined) {
    await flushOutbox(app.infrastructure)
  }
  const message = app.infrastructure.fakeEmail.latestTo(email)
  if (message === undefined) {
    throw new Error(`No verification email was sent to ${email}`)
  }
  const url = app.infrastructure.fakeEmail.extractUrl(message)
  const parsed = new URL(url)

  // The verification link points at Better Auth's own GET endpoint; replay
  // its path and query exactly as a browser clicking the link would.
  const response = await app.request('GET', `${parsed.pathname}${parsed.search}`)
  if (response.status >= 400) {
    throw new Error(
      `Email verification failed (${response.status}): ${JSON.stringify(response.body)}`,
    )
  }
}

/** Sign in and return a fully usable authenticated test user. */
export async function signIn(
  app: TestApp,
  input: { email: string; password: string; name: string; userId: string },
): Promise<TestUser> {
  const response = await app.request('POST', '/api/v1/auth/sign-in/email', {
    body: { email: input.email, password: input.password },
  })
  if (response.status !== 200) {
    throw new Error(`Sign-in failed (${response.status}): ${JSON.stringify(response.body)}`)
  }

  const cookie = cookieHeaderFrom(response.raw)
  if (cookie === '') {
    throw new Error('Sign-in succeeded but no session cookie was returned.')
  }

  return {
    email: input.email,
    password: input.password,
    name: input.name,
    userId: input.userId,
    cookie,
  }
}

/** Sign up, verify, and sign in a fresh user in one call. */
export async function createVerifiedUser(
  app: TestApp,
  overrides: Partial<{ email: string; password: string; name: string }> = {},
): Promise<TestUser> {
  const email = overrides.email ?? `user-${crypto.randomUUID()}@example.org`
  const password = overrides.password ?? 'correct horse battery staple 1'
  const name = overrides.name ?? 'Test User'

  const { userId } = await signUp(app, { email, password, name })
  await verifyEmail(app, email)
  return signIn(app, { email, password, name, userId })
}
