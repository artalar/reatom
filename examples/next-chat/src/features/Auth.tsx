import React from 'react'
import { Style, styled } from 'stylerun'
import { useModel } from '@reatom/react'
import { onInput, onSubmit, authAtom } from './Auth/model'

const Container = styled('main')

export const Auth = () => {
  const {
    handleInput,
    handleSubmit,
    auth: { name, password },
  } = useModel(() => ({
    handleInput: (e: React.FormEvent<HTMLFormElement>) => {
      const { name, value } = e.target as HTMLInputElement
      return onInput(name as 'name' | 'password', value)
    },
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      return onSubmit()
    },
    auth: authAtom,
  }))

  return (
    <Container>
      <form
        className="nes-container with-title"
        onInput={handleInput}
        onSubmit={handleSubmit}
      >
        <h2 className="title">Auth</h2>
        <div className="nes-field">
          <label>Name:</label>
          <input
            className="nes-input"
            value={name}
            placeholder="Enter your nickname"
            name="name"
            type="text"
            minLength={3}
            required
            autoFocus
          />
        </div>
        <br />
        <div className="nes-field">
          <label>Password:</label>
          <input
            className="nes-input"
            value={password}
            placeholder="Enter your password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={4}
            required
          />
        </div>
        <br />
        <button className="nes-btn is-primary" type="submit">
          Submit
        </button>
      </form>
      <Style>{`
        ${Container} { 
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        ${Container} button {
          float: right;
        }
      `}</Style>
    </Container>
  )
}
