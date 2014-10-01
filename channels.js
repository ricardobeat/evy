(function(){

    var uid   = 0
    var slice = Array.prototype.slice
    var EventEmitter

    var registeredChannels = {}

    if (typeof require !== 'undefined') {
        EventEmitter = require('./events')
    } else {
        EventEmitter = this.Emmy || this.EventEmitter
    }

    function _bind (fn, context, args) {
        return function () {
            fn.apply(context, args || arguments)
        }
    }

    function validateEvent (channel, method, name) {
        if (channel.strict && !channel.events[name]) {
            throw new Error(
                method + "(): event '" + name + "' has not been registered for channel " + channel.name
            )
        }
    }

    function EventChannel (name, options) {
        if (typeof name === 'object') {
            options = name
            name = options.name
        }

        var options = options || {}

        if (!name) {
            throw new Error('Channel must have a name.')
        }

        if (registeredChannels[name]) {
            throw new Error('Channel \'' + name + '\' already exists.')
        } else {
            registeredChannels[name] = this
        }

        if (options.strict !== false && !options.events) {
            throw new Error('Channel ' + name + ' is in strict mode but no events have been defined')
        }

        this.name    = name || options.name || (+new Date).toString(32)
        this.emitter = new EventEmitter({ context: this })
        this.events  = options.events || {}
        this.strict  = options.strict === false ? false : true
    }

    EventChannel.prototype.subscribe = function (name, fn) {
        validateEvent(this, 'subscribe', name)
        this.emitter.addListener(name, fn)
    }

    EventChannel.prototype.publish = function (name, data) {
        validateEvent(this, 'publish', name)
        this.emitter.emit(name, data)
    }
    
    EventChannel.prototype.unsubscribe = function (name, fn) {
        validateEvent(this, 'unsubscribe', name)
        this.emitter.removeListener(name, fn)
    }

    EventChannel.prototype.destroy = function (name) {
        this.emitter.destroy()
        delete registeredChannels[name]
    }

    EventChannel.create = function (name, options) {
        return new EventChannel(name, options)
    }

    // Channel manager
    // ------------------------------------------------------------------------
    
    function channel (name, options) {
        if (options === undefined && channel.channels[name]) {
            return channel.channels[name]
        } else if (name && typeof options === 'object' && channel.channels[name] === undefined) {
            var channel = new EventChannel(name, options)
            channel.channels[name] = channel
            return channel
        } else if (channel.channels[name]) {
            throw new Error('Channel ' + name + ' is already defined.')
        } else {
            throw new Error('Channel ' + name + ' does not exist.')
        }
    }

    channel.channels = []

    // Export commonJS / global / AMD
    // ------------------------------------------------------------------------
    
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { EventChannel: EventChannel, channel: channel }
    } else if (typeof define !== 'undefined') {
        define('channel/EventChannel', function () { return EventChannel })
        define('channel', function () { return channel })
    } else {
        this.EventChannel = EventChannel
        this.channel = channel
    }

}).call(this)
