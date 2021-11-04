import { publish } from './publish'

const changedPackages = [
  ...new Set(process.argv
    .slice(2)
    .map((path) => path.split('/')[1])
  ),
]

publish(changedPackages)
