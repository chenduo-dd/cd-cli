const program = require('commander')
const path = require('path')
const { version } = require('./constants')

const mapActions = {
  create: {
    alias: 'c',
    description: 'create a project',
    example: ['cd-cli create <project-name>']
  },
  '*': {
    alias: '',
    description: 'command no found',
    example: []
  }
}

Reflect.ownKeys(mapActions).forEach(action => {
  program
    .command(action)
    .alias(mapActions[action].alias)
    .description(mapActions[action].description)
    .action(() => {
      if (action == '*') {
        return console.log(mapActions[action].description)
      } else {
        require(path.resolve(__dirname, action))(...process.argv.slice(3))
      }
    })
})

program.on('--help', () => {
  console.log('\nExample:')

  Reflect.ownKeys(mapActions).forEach(action => {
    mapActions[action].example.forEach(example => {
      console.log(action + '|' + mapActions[action].alias + ' ' + example)
    })
  })
})



program.version(version).parse(process.argv)