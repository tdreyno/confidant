const { rest } = require("msw")
const { setupServer } = require("msw/node")
const { handlers } = require("./server-handlers.js")
const server = setupServer(...handlers)
module.exports = { server, rest }
