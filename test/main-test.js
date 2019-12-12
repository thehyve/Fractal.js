import { init } from '../src/main'

describe('initializer', () => {
  it('throws if given invalid parameters', () => {
    let f = () => init({service: '', fractalisNode: 'foo', getAuth: () => {}})
    expect(f).toThrow()
    f = () => init({service: 'foo', fractalisNode: '', getAuth: () => {}})
    expect(f).toThrow()
    f = () => init({service: 'foo', getAuth: () => {}})
    expect(f).toThrow()
    f = () => init({service: 'foo', fractalisNode: 'foo'})
    expect(f).toThrow()
  })

  afterAll(() => {
    document.body.innerHTML = ''
  })
})
