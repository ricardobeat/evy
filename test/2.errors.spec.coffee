
EventEmitter = require '../events'
assert = require 'assert'
extend = require('util')._extend

process.on 'uncaughtException', (err) ->
  # console.log(err)

suite.skip "Error handling", ->

  test 'sync error stops the emitter', ->
    x = new EventEmitter()
    x.on 'test', -> throw new Error('failing')
    x.on 'test', -> throw new Error('should never run')
    assert.throws (-> x.emit('test')), /failing/

  if process?

    test 'async error DOES NOT stop the emitter', (done) ->
      failed = new Error('this error should be replaced with undefined')
      x = new EventEmitter({ async: true })
      x.on 'test', -> throw new Error('failing one')
      x.on 'test', -> throw new Error('failing two')
      x.on 'test', -> done(failed)
      x.emit 'test'

      # remove mocha's own error listener
      originalException = process.listeners('uncaughtException').pop()
      process.removeListener('uncaughtException', originalException)

      # wait for both errors
      process.on 'uncaughtException', (err) ->
        assert.ok /^failing/.test(err.message)
        if err.message is 'failing two'
          process.nextTick ->
            failed = undefined
            process.listeners('uncaughtException').push(originalException)

