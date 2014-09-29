(function(){

    var uid   = 0
    var slice = Array.prototype.slice

    function _bind (fn, context, args) {
        return function () {
            fn.apply(context, args || arguments)
        }
    }

    function EventChannel (options) {
        options || (options = {})
        this.name    = options.name || (+new Date).toString(32)
        this.emitter = new EventEmitter({ context: this })
        this.events  = options.events || {}
    }

    function validateEvent (channel, method, name) {
        if (!this.events[name]) {
            throw new Error(
                method + "(): event '" + name + "' has not been registered for channel " + channel.name
            )
        }
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

    EventChannel.create = function (options) {
        return new Channel(options)
    }

    // Export commonJS / global / AMD
    // ------------------------------------------------------------------------
    
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EventChannel
    } else if (typeof define === 'function') {
        define('EventChannel', function () { return EventChannel })
    } else {
        this.EventChannel = EventChannel
    }

}).call(this)
