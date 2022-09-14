import type { NextApiRequest, NextApiResponse } from 'next'

import gqlClient from '~/graphql'

export async function getMessages(session: string, from?: number) {
  if (!session) return null

  const request = from
    ? gqlClient.getNewMessages({
        session,
        from,
      })
    : gqlClient.getMessages({
        session,
      })

  const { users, messages } = await request

  if (users.length === 0) return null

  const { name } = users[0]

  return messages.map((msg) => ({ ...msg, isSelf: msg.author === name }))
}

export default async function handleMessages(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { session } = req.cookies

  if (!session) return res.status(403).end()

  if (req.method?.toLowerCase() === 'post') {
    const { users } = await gqlClient.getUser({ session })

    if (users.length === 0) return res.status(403).end()

    await gqlClient.createMessage({
      author: users[0].name,
      text: JSON.parse(req.body).text,
    })

    return res.status(200).end()
  }

  const messages = await getMessages(session, Number(req.query.from))

  if (messages) res.json(messages)
  else res.status(403).end()

  return
}
