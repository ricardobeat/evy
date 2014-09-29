(function(){

    var slice = Array.prototype.slice
    var _hasImmediate = (typeof setImmediate === 'function')

    // Doing this is faster and uses less memory than Function::bind
    function _bind (fn, context, args) {
        return function () {
            return fn.apply(context, args)
        }
    }

    // EventEmitter constructor
    // ------------------------------------------------------------------------

    function EventEmitter (options) {
        options || (options = {})
        this._events    = {}               // listeners attached to this emitter
        this._listening = []               // remote listeners (listenTo)
        this.context    = options.context  // default emitter context
        this.count      = 0
        if (options.debug) {
            this._debug = true
            this._last  = { time: 0, count : 0 }
        }
        if (options.async) {
            this._async = true
            this.emitSync = this.emit
            this.emit = this.emitNext
        }
    }

    // Adds a handler to the events list
    EventEmitter.prototype.addListener = function (name, fn, context) {
        var handlers = this._events[name] || (this._events[name] = [])
        handlers.push(context ? { fn: fn, context: context } : fn)
        for (var i in handlers) {
            if (handlers[i] == null) handlers.splice(i, 1)
        }
        return this
    }

    // Add a handler that can only get called once
    EventEmitter.prototype.once = function (name, fn) {
        var self  = this
        var fired = false
        function onceFn () {
            if (!fired) {
                fired = true
                fn.apply(this, arguments)
                self.removeListener(name, onceFn)
            }
        }
        return this.addListener(name, onceFn)
    }

    // Removes a handler from the events list
    EventEmitter.prototype.removeListener = function (name, fn, context) {
        var self     = this
        var handlers = this._events[name]
        if (name === '*') {
            if (!fn) {
                // Remove all events
                this._events = {}
            } else {
                // Remove given function from all events
                for (var _name in this._events) {
                    if (this._events.hasOwnProperty(_name)) {
                        self.removeListener(_name, fn)
                    }
                }
            }
        } else if (fn && handlers) {
            // By name and function
            // Find handlers that match the given function
            for (var i in handlers) {
                if (handlers[i] && (handlers[i] === fn || handlers[i].fn === fn)) {
                    // instead of calling .splice(i, 1) here, we'll
                    // set this handler to null and defer the cleanup
                    // to the next addListener call
                    handlers[i] = null
                }
            }
            // Remove event key if there are no event handlers left
            if (handlers.length === 0) {
                delete this._events[name]
            }
        } else {
            // By name only, remove all handlers for this event
            delete this._events[name]
        }
        return this
    }

    EventEmitter.prototype.emitNext = function (name) {
        var self = this, args = arguments
        var run = _bind(EventEmitter.prototype.emit, self, args)
        if (_hasImmediate) {
            return setImmediate(run)
        } else {
            return setTimeout(run, 0)
        }
    }

    // Calls all handlers that match the event type
    EventEmitter.prototype.emit = function (name) {
        var handlers = this._events[name]
        this._debug && this.tick()
        // Return early if there are no listeners for this event
        if (!handlers) return this
        for (var i = 0, ln = handlers.length; i < ln; i++) {
            var handler = handlers[i]
            if (!handler) continue
            var context = handler.context || this._context || this
            var fn      = handler.fn || handler
            var length  = arguments.length
            // optimize most common calls (inspired by Backbone)
            switch (length) {
                case 1: fn.call(context); break
                case 2: fn.call(context, arguments[1]); break
                case 3: fn.call(context, arguments[1], arguments[2]); break
                default:
                    // args optimization borrowed from node EventEmitter (lib/events.js)
                    var args = new Array(length - 1)
                    for (i = 1; i < length; i++) args[i - 1] = arguments[i]
                    fn.apply(context, args)
            }
        }
        return this
    }

    // For debugging purposes. Counts the number of emitted events over time
    // and calculates a running average rate for the past 2 seconds
    EventEmitter.prototype.tick = function () {
        var now  = +new Date
        var last = this._last
        this.count++
        if (now - last.time > 5000) {
            this.rate = Math.floor((this.count - last.count) / (now - last.time) / 1000)
            this._last = { time: now, count: this.count }
        }
    }

    // Returns a function that emits a $name event
    EventEmitter.prototype.proxy = function (name) {
        var self = this
        return function () {
            var args = slice.call(arguments, 0)
            args.unshift(name)
            self.emit.apply(self, args)
        }
    }

    // Attaches a listener to another object while keeping track of all listeners added
    EventEmitter.prototype.listenTo = function (target, name, fn, context) {
        var listener = new RemoteListener(target, name, fn, context)
        listener.attach()
        this._listening.push(listener)
    }

    // Remove all remote listeners
    EventEmitter.prototype.stopListening = function (target, name, fn) {
        for (var i = 0, listener; listener = this._listening[i]; i++) {
            if (listener.matches(target, name, fn)) {
                listener.detach()
            }
        }
    }

    // Remove all own & remote listeners
    EventEmitter.prototype.destroy = function () {
        this.removeListener('*')
        this.stopListening()
    }

    // RemoteListener
    // ------------------------------------------------------------------------
    // Tracks a listener added to another object, used in the .listenTo() method
    
    function RemoteListener (target, name, fn, context) {
        this.target  = target
        this.name    = name
        this.fn      = fn
        this.context = context
    }

    // Add listener to remote object
    RemoteListener.prototype.attach = function () {
        var target = this.target
        var method = target.addListener || target.on || target.bind
        method.call(target, this.name, this.fn, this.context)
        return this
    }

    // Remove listener from remote object
    RemoteListener.prototype.detach = function () {
        var target = this.target
        var method = target.removeListener || target.off || target.unbind
        method.call(target, this.name, this.fn)
        return this
    }

    // Null parameters mean "match all"
    RemoteListener.prototype.matches = function (target, name, fn) {
        return (
            (!target || target === this.target) &&
            (!name   || name === this.name) &&
            (!fn     || fn === this.fn)
        )
    }

    // Instance creation & inheritance methods
    // ------------------------------------------------------------------------
    
    EventEmitter.extend = function (target) {
        var emitter = new EventEmitter()
        target._emitter = emitter
        for (var key in EventEmitter.prototype) {
            target[key] = EventEmitter.prototype[key].bind(emitter)
        }
    }

    EventEmitter.create = function (options) {
        return new EventEmitter(options)
    }

    // Method aliases
    // ------------------------------------------------------------------------
    
    var aliases = {
        on      : 'addListener',
        off     : 'removeListener',
        trigger : 'emit'
    }
    for (var key in aliases) {
        EventEmitter.prototype[key] = EventEmitter.prototype[aliases[key]]
    }

    // Export commonJS / global / AMD
    // ------------------------------------------------------------------------
    
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EventEmitter
    } else if (typeof define === 'function') {
        define('EventEmitter', function () { return EventEmitter })
    } else {
        this.EventEmitter = EventEmitter
    }

}).call(this)
