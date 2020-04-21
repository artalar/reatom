import { futureFrom } from '.'

type User = {
  id: string
  name: string
  logo: string
}

const viewLogo = (data: any) => {
  // eslint-disable-next-line no-console
  console.log(data)
}

// future
const requestUser = futureFrom(
  (id: string) =>
    // fetch(`/api/user/${id}`).then(v => v.json() as Promise<User>),
    ({
      id,
      name: 'name',
      logo: 'logo',
    } as User),
)

// atom
const userLogo = requestUser.chain({
  defaultState: '/assets/placeholderLogo',
  executor: user => user.logo,
})

// subscription
userLogo.subscribe(url => viewLogo(url))

// usage
requestUser('42')
