export const Title = ({ name }: { name: string }) => {
  name = name.toLowerCase().replace(/ /g, '_')
  return (
    <h2 id={name}>
      <a href={`#${name}`}>#</a>About
    </h2>
  )
}
