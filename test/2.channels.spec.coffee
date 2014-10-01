
EventEmitter = require '../events'
channels     = require '../channels'
assert       = require('assert')

suite 'Event channels', ->

    test 'createChannel', ->
        channel = channels.createChannel 'test-create', { events: {} }
        assert.equal typeof channel, 'object'
        assert.equal channel.constructor, EventEmitter
        assert.equal typeof channel.publish, 'function'
        assert.equal typeof channel.subscribe, 'function'
        assert.equal typeof channel.unsubscribe, 'function'

    test 'channel name', ->
        channel = channels.createChannel 'test-name', { events: {} }
        assert.equal channel.name, 'test-name'

    test 'channel name via options', ->
        channel = channels.createChannel { name: 'test-name-2', events: {} }
        assert.equal channel.name, 'test-name-2'

    test 'duplicate names not allowed', ->
        assert.throws ->
            channels.createChannel 'test-dupe', { events: {} }
            channels.createChannel 'test-dupe', { events: {} }
        , /already/

    test 'emitting unregistered event should throw', ->
        channel = channels.createChannel 'test-unregistered', { events: {} }
        assert.throws ->
            channel.publish('something')
        , /not.*registered/
        

    test 'register, emit and receive event', (done) ->
        channel = channels.createChannel {
            name: 'test-emit'
            events: { test: 'Test event' }
        }
        channel.subscribe 'test', done
        channel.publish 'test'

    test 'unsubscribe', ->
        test 'register, emit and receive event', ->
            channel = channels.createChannel {
                name: 'test-emit'
                events: { test: 'Test event' }
            }
            channel.subscribe 'test', -> assert.fail()
            channel.unsubscribe 'test'
            channel.publish 'test'
