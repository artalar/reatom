import React from 'react'
import { Style, styled } from 'stylerun'
import { useModel } from '@reatom/react'
import { messagesAtom, sendMessage } from './Chat/model'

const Container = styled(`main`)
const Form = styled(`form`)
const MessageWindow = styled(`section`)
const Profile = styled(`div`)
const Nickname = styled(`span`)
const Input = styled(`textarea`)

export const Chat = () => {
  const { messages, handleSend } = useModel(() => ({
    messages: messagesAtom,
    handleSend: sendMessage,
  }))

  return (
    <Container>
      <MessageWindow className="nes-container">
        <section className="message-list">
          {messages.map((msg, index) => {
            // FIXME:
            // @ts-expect-error
            const { isSelf } = msg
            const direction = isSelf ? `-right` : `-left`
            return (
              <section className={`message ${direction}`}>
                {!isSelf && (
                  <Profile>
                  <i className="nes-bcrikko"></i>
                    <Nickname>@{msg.author}</Nickname>
                  </Profile>
                )}
                <div key={index} className={`nes-balloon from${direction}`}>
                  <p>{msg.text}</p>
                </div>
                {isSelf && <i className="nes-bcrikko"></i>}
              </section>
            )
          })}
        </section>
      </MessageWindow>
      <Form
        onSubmit={(e) => {
          e.preventDefault()
          const input = e.currentTarget.querySelector('textarea')!
          handleSend(input.value)
          input.value = ''
        }}
      >
        <Input placeholder="Type a message..."></Input>
        <button type="submit">Send</button>
      </Form>
      <Style>{`
        ${Container} {
          display: flex;
          flex-direction: column;
          width: 100vw;
          padding: 2rem calc((100vw - 50rem) / 2);
          height: 100vh;
        }
        ${MessageWindow} {
          flex: 1;
          overflow: auto;
          word-break: break-all;
        }
        ${Profile} {
          display: flex;
          flex-direction: column;
        }
        ${Nickname} {
          margin-top: 0.5em;
          max-width: 100px;
        }
        ${Form} {
          display: flex;
        }
        ${Input} {
          flex: 1;
        }
      `}</Style>
    </Container>
  )
}

export default Chat
