
EventEmitter = require '../events'
assert = require('assert')

next = (fn) -> setTimeout fn, 2

suite 'EventEmitter', ->

    test 'add listener', ->
        emitter = new EventEmitter
        emitter.on 'click', -> null
        assert.equal emitter._events['click'].length, 1

    test 'remove listener', ->
        x = new EventEmitter
        fn = -> 123

        x.on 'click', fn
        x.removeListener 'click', fn
        x.emit 'click', -> assert.fail('Remove listener by reference')

        x.on 'click', fn
        x.removeListener 'click'
        x.emit 'click', -> assert.fail('Remove listener by name')
    
    test 'remove all listener', ->
        x = new EventEmitter
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

    test 'emit event', (done) ->
        x = new EventEmitter
        x.on 'click', (arg) ->
            assert.equal arg, 55
            done()
        x.emit 'click', 55

    test 'event parameters', (done) ->
        x = new EventEmitter
        x.on 'testevent', (first) ->
            assert.equal first, 0
            assert.equal arguments[721], 721
            assert.equal arguments.length, 1000
            done()
        args = [0..999]
        args.unshift 'testevent'
        x.emit.apply x, args

    test 'listen once', (done) ->
        x = new EventEmitter
        count = 0
        x.once 'click', (arg) ->
            count++
            assert arg is 4, "Argument received"
        x.emit 'click', 4
        x.emit 'click', 5
        
        next ->
            assert count is 1
            done()

    # regression test - https://github.com/ryejs/rye/issues/30
    test 'multiple once handlers', ->
        x = new EventEmitter
        x.once 'test', ->
        x.once 'test', ->
        x.once 'test', ->
        x.emit 'test'
        assert.ok true

    test 'listenTo', (done) ->
        a = new EventEmitter
        b = new EventEmitter
        a.listenTo b, 'wow',done
        b.emit 'wow'

    test 'listenTo parameters', (done) ->
        a = new EventEmitter
        b = new EventEmitter
        a.listenTo b, 'testevent', (first) ->
            assert.equal first, 0
            assert.equal arguments[376], 376
            assert.equal arguments.length, 1000
            done()
        args = [0..999]
        args.unshift 'testevent'
        b.emit.apply b, args

    stopTest = ->
        a = new EventEmitter
        b = new EventEmitter
        fail = -> throw new Error 'event should not fire'
        a.listenTo b, 'testevent', fail
        return [a,b,fail]

    test 'stopListening', (done) ->
        [a, b] = stopTest()
        a.stopListening()
        b.emit 'testevent'
        next(done)

    test 'stopListening all', (done) ->
        [a, b] = stopTest()
        a.stopListening()
        b.emit 'testevent'
        next(done)

    test 'stopListening by name', (done) ->
        [a, b] = stopTest()
        a.stopListening b, 'testevent'
        b.emit 'testevent'
        next(done)

    test 'stopListening by name & handler', (done) ->
        [a, b, fail] = stopTest()
        a.stopListening b, 'testevent', fail
        b.emit 'testevent'
        next(done)


# suite 'PubSub', ->

#     test 'subscribe publish', (done) ->
#         $.subscribe 'sign', (arg) ->
#             assert arg is 55, "Argument received"
#             done()
#         $.publish 'sign', 55

#     test 'unsubscribe', (done) ->
#         $.subscribe 'sign', ->
#             assert false, "Event shouldn't be emmited"
#         $.unsubscribe 'sign'
#         $.publish 'sign'
#         setTimeout ->
#             done()
#         , 0
