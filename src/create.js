const axios = require('axios')
const ora = require('ora')
const Inquirer = require('inquirer')
const path = require('path')
const fs = require('fs')
let ncp = require('ncp')
// 遍历文件夹找寻需要渲染的
let metalSmith = require('metalsmith')
let { render } = require('consolidate').ejs
let downloadGitRepo = require('download-git-repo')
const { downloadDirectory } = require('./constants')
const { promisify } = require('util')
downloadGitRepo = promisify(downloadGitRepo)
ncp = promisify(ncp)
render = promisify(render)
// create的逻辑

const fetchRepoList = async () => {
  const { data } = await axios.get('https://api.github.com/orgs/zhu-cli/repos')
  return data
}

const fetchTagList = async (repo) => {
  const { data } = await axios.get(`https://api.github.com/repos/zhu-cli/${repo}/tags`)
  return data
}

const waitFnLoading = (fn, massage) => async (...args) => {
  const spinner = ora(massage)
  spinner.start()
  const data = await fn(...args)
  spinner.succeed()
  return data
}

const download = async (repo, tag) => {
  let api = `zhu-cli/${repo}`
  tag && (api += `#${tag}`)
  let dest = `${downloadDirectory}/${repo}`
  await downloadGitRepo(api, dest)
  return dest
}

module.exports = async (projectName) => {
  let repos = await waitFnLoading(fetchRepoList, 'fetch template...')()
  repos = repos.map(item => item.name)
  // 选择模板 inquiere
  const { repo } = await Inquirer.prompt({
    name: 'repo',
    type: 'list',
    message: '请选择一个模板创建项目',
    choices: repos
  })
  let tags = await waitFnLoading(fetchTagList, 'fetch tags...')(repo)
  tags = tags.map(item => item.name)

  const { tag } = await Inquirer.prompt({
    name: 'tag',
    type: 'list',
    message: '请选择模板版本号',
    choices: tags
  })

  const result = await download(repo, tag)
  // 区别复杂模板
  if (!fs.existsSync(path.join(result, 'ask.json'))) {
    ncp(result, path.resolve(projectName))
  } else {
    await new Promise((resolve, reject) => {
      // 让用户填信息
      metalSmith(__dirname)
        .source(result)
        .destination(path.resolve(projectName))
        .use(async (files, metal, done) => {
          const args = require(path.join(result, 'ask.json'))
          let obj = await Inquirer.prompt(args)
          const meta = metal.metadata()
          Object.assign(meta, obj)
          delete files['ask.json']
          done()
        })
        .use(async (files, metal, done) => {
          Reflect.ownKeys(files).forEach(async file => {
            const obj = metal.metadata()
            if (file.includes('js') || file.includes('json')) {
              let content = files[file].contents.toString()
              if (content.includes('<%')) {
                content = await render(content, obj)
                files[file].contents = Buffer.from(content)
              }
            }
          })
          done()
        })
        .build((err) => {
          if (err) {
            reject(err)
          }
        })
    })
    // 用用户填写的信息去渲染模板
  }

}