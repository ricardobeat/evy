
EventEmitter = require '../'

assert = require 'assert'
extend = require('util')._extend

require('../listenTo').extend(EventEmitter)

defineSuite = (suiteName, options) ->

    moarEmitters = (n) ->
        return (new EventEmitter(options) for i in [0..n])

    suite "#{suiteName}", ->

        fail = ->
            throw new Error 'event should not fire'

        isEmitter = (ee) ->
            assert.equal typeof ee, 'object'
            assert.equal typeof ee.addListener, 'function'
            assert.equal typeof ee.removeListener, 'function'
            assert.equal typeof ee.emit, 'function'

        test 'constructor', ->
            isEmitter new EventEmitter(options)

        test '.create', ->
            isEmitter EventEmitter.create()

        suite 'add / remove', ->

            test 'add listener', (done) ->
                emitter = new EventEmitter(options)
                emitter.on 'click', done
                emitter.emit 'click'

            test 'remove listener', ->
                x = new EventEmitter(options)
                fn = -> 123

                x.on 'click', fn
                x.removeListener 'click', fn
                x.emit 'click', -> assert.fail('Remove listener by reference')

                x.on 'click', fn
                x.removeListener 'click'
                x.emit 'click', -> assert.fail('Remove listener by name')

            test 'remove all listener', ->
                x = new EventEmitter(options)
                fn = -> 123

                x.on 'click', fn
                x.on 'keydown', fn
                x.removeListener '*', fn
                x.emit 'click', -> assert.fail('Remove listener by reference')
                x.emit 'keydown', -> assert.fail('Remove listener by reference')

                x.on 'click', fn
                x.on 'keydown', fn
                x.removeListener '*'
                x.emit 'click', -> assert.fail()
                x.emit 'keydown', -> assert.fail()


        suite 'emit', ->

            test 'emit event', (done) ->
                x = new EventEmitter(options)
                x.on 'click', (arg) ->
                    assert.equal arg, 55
                    done()
                x.emit 'click', 55

            test 'event parameters', (done) ->
                x = new EventEmitter(options)
                x.on 'testevent', (first) ->
                    assert.equal first, 0
                    assert.equal arguments[721], 721
                    assert.equal arguments.length, 1000
                    done()
                args = [0..999]
                args.unshift 'testevent'
                x.emit.apply x, args

            # regression: 1db72bb
            test 'emit with 4+ handlers and arguments', (done) ->
                args = [0...10]
                args.unshift 'testevent'
                x = new EventEmitter(options)
                x.count = 0
                for l in [0...10]
                    x.on 'testevent', (first) ->
                        assert.equal first, 0
                        assert.equal arguments.length, 10
                        if ++@count is 10 then done()
                x.emit.apply x, args

            if /async/.test suiteName
                test 'emit before listen', (done) ->
                    x = new EventEmitter(options)
                    x.emit 'test-before'
                    x.on 'test-before', -> done()


        suite 'once', ->

            test 'listen once', (done) ->
                x = new EventEmitter(options)
                count = 0
                x.once 'click', (arg) ->
                    count++
                    assert arg is 4, "Argument received"
                x.emit 'click', 4
                x.emit 'click', 5

                setImmediate ->
                    assert count is 1
                    done()

            # regression test - https://github.com/ryejs/rye/issues/30
            test 'multiple once handlers', ->
                x = new EventEmitter(options)
                x.once 'test', ->
                x.once 'test', ->
                x.once 'test', ->
                x.emit 'test'
                assert.ok true


        suite 'listenTo', ->

            test 'listenTo', (done) ->
                [a, b] = moarEmitters 2
                a.listenTo b, 'wow',done
                b.emit 'wow'

            test 'listenTo parameters', (done) ->
                [a, b] = moarEmitters 2
                a.listenTo b, 'testevent', (first) ->
                    assert.equal first, 0
                    assert.equal arguments[376], 376
                    assert.equal arguments.length, 1000
                    done()
                args = [0..999]
                args.unshift 'testevent'
                b.emit.apply b, args

            test 'listenToOne', (done) ->
                [a, b] = moarEmitters 2
                a.listenToOne b, 'testevent', done
                b.emit 'testevent' for i in [1..3]


        suite 'stopListening', ->

            test 'stopListening', (done) ->
                [a, b] = moarEmitters 2
                a.listenTo b, 'testevent', fail
                a.stopListening()
                b.emit 'testevent'
                setImmediate(done)

            test 'stopListening all', (done) ->
                [a, b] = moarEmitters 2
                a.listenTo b, 'testevent', fail
                a.stopListening()
                b.emit 'testevent'
                setImmediate(done)

            test 'stopListening by name', (done) ->
                [a, b] = moarEmitters 2
                a.listenTo b, 'testevent', fail
                a.stopListening b, 'testevent'
                b.emit 'testevent'
                setImmediate(done)

            test 'stopListening by name & handler', (done) ->
                [a, b] = moarEmitters 2
                a.listenTo b, 'testevent', fail
                a.stopListening b, 'testevent', fail
                b.emit 'testevent'
                setImmediate(done)

            test 'stopListening from listenToOne', (done) ->
                [a, b] = moarEmitters 2
                a.listenToOne b, 'testevent', -> throw new Error 'should not fire'
                a.stopListening()
                b.emit 'testevent'
                setImmediate(done)

        suite 'strict mode', ->

            emitter = new EventEmitter(extend({
                strict: true
                events: { hello: 'Hello event' }
            }, options))

            test 'emitting unregistered event should throw', ->
                assert.throws -> emitter.emit 'lalala'

            test 'listening to unregistered event should throw', ->
                assert.throws -> emitter.addListener 'lalala', ->
                assert.throws -> emitter.once 'lalala', ->

            test 'removing unregistered event should throw', ->
                assert.throws -> emitter.removeListener 'lalala'

            test 'registered event is allowed', ->
                assert.doesNotThrow -> emitter.emit('hello')


# -----------------------------------------------------------------------------

# Run the entire suite for sync + async + debug modes

defineSuite('EventEmitter', {})
defineSuite('EventEmitter (debug)', { debug: true })
defineSuite('EventEmitter (async)', { async: true })
defineSuite('EventEmitter (async + debug)', { async: true, debug: true })
