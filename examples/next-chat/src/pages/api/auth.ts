import bcrypt from 'bcrypt'
import type { NextApiRequest, NextApiResponse } from 'next'

import gqlClient from '~/graphql'

export type AuthQuery = Partial<{
  username: string
  password: string
}>

export default async function handleAuth(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { username, password } = req.query as AuthQuery

  if (!username || !password) {
    return res.status(403).end()
  }

  const { users } = await gqlClient.getUserSession({
    name: username,
  })

  if (users.length === 0) {
    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10))
    const session = await bcrypt.hash(
      Math.random().toString(),
      await bcrypt.genSalt(1),
    )
    const { insert_users_one } = await gqlClient.createUser({
      name: username,
      password: hashedPassword,
      session,
    })
    if (insert_users_one?.session !== session) {
      res.status(403).end()
      return
    }
    writeCookie(session)
    res.status(200).end()
  } else if (users.length === 1) {
    if (await bcrypt.compare(password, users[0].password)) {
      writeCookie(users[0].session!)
      res.status(200).end()
    } else {
      res.status(403).end()
    }
  } else {
    res.status(500).end(`Users collision`)
  }

  function writeCookie(session: string) {
    res.setHeader(
      `Set-Cookie`,
      `session=${session}; SameSite=Strict; HttpOnly; Path=/;`,
    )
  }
}
