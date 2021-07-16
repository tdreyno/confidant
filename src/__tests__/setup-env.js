const { server } = require("./server.js")
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
