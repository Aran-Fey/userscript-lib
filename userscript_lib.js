(function(){
    /* 
     * Sets a global variable.
     */
    function set_global(name, value){
        window[name] = value;
        
        if (typeof unsafeWindow !== 'undefined'){
            unsafeWindow[name] = value;
        }
    }
    /* 
     * Retrieves the value of a global variable or undefined if that variable
     * doesn't exist.
     */
    function get_global(name){
        var value = window[name];
        if (value !== undefined){
            return value;
        }
        
        if (typeof unsafeWindow === 'undefined'){
            return undefined;
        }
        
        return unsafeWindow[name];
    }
    
    if (get_global('USlib') !== undefined){
        return;
    }
    set_global('USlib', true);
    
    set_global('set_global', set_global);
    set_global('get_global', get_global);
    
    /* 
     * Compatability layer for different userscript addons
     */
    set_global('UserScript', class UserScript {
        static getValue(name, default_){
            if (typeof GM_getValue !== 'undefined'){
                return new Promise(function(resolve, reject) {
                    resolve(GM_getValue(name, default_));
                });
            } else {
                return GM.getValue(name, default_);
            }
        }
        
        static setValue(name, value){
            if (typeof GM_setValue !== 'undefined'){
                return new Promise(function(resolve, reject) {
                    resolve(GM_setValue(name, value));
                });
            } else {
                return GM.setValue(name, value);
            }
        }
    });
    
    /* 
     * Convenience base class with some useful methods
     */
    set_global('BaseClass', class BaseClass {
        clone(){
            return Object.create(this);
        }
        
        is_a(cls){
            return this.constructor === cls;
        }
        is_any(classes){
            for (const cls of classes){
                if (this.is_a(cls)){
                    return true;
                }
            }
            return false;
        }
    });
    
    /* 
     * Sorts an array based on a key function. Returns a new array.
     */
    set_global('keyed_sort', function keyed_sort(arr, keyfunc){
        const keyedArr = arr.map(obj => [keyfunc(obj), obj]);
        keyedArr.sort((a, b) => a[0] - b[0]);
        
        return keyedArr.map(pair => pair[1]);
    });
    
    /* 
     * Class that transparently wraps around an existing DOM element
     */
    set_global('ElementWrapper', class ElementWrapper extends BaseClass {
        constructor(element){
            super();
            this.element = element;
        }

        static from_element(element){
            var instance = this._instances_by_element.get(element);
            if (instance !== undefined){
                return instance;
            }

            instance = new this(element);
            this._instances_by_element.set(element, instance);
            return instance;
        }

        hide(){
            this.element.style.display = 'none';
        }
        
        remove(){
            this.element.remove();
        }

        get dataset(){
            return this.element.dataset;
        }

        get textContent(){
            return this.element.textContent;
        }

        get classList(){
            return this.element.classList;
        }

        get lastChild(){
            return this.element.lastChild;
        }

        getElementById(id){
            return document.getElementById(id);
        }

        getElementsByClassName(classname){
            return this.element.getElementsByClassName(classname);
        }

        getElementsByTagName(tagname){
            return this.element.getElementsByTagName(tagname);
        }

        querySelector(selector){
            return this.element.querySelector(selector);
        }

        querySelectorAll(selector){
            return this.element.querySelectorAll(selector);
        }
    });
    ElementWrapper._instances_by_element = new Map();
    
    /* 
     * Abstract base class for classes that wrap around an existing DOM element
     * and can be identified by some sort of unique id.
     * 
     * Subclasses must implement the static _get_id(element) method.
     */
    set_global('IDElementWrapper', class IDElementWrapper extends ElementWrapper {
        static from_element(element){
            const id = this._get_id(element);

            var instance = this._instances_by_id.get(id);
            if (instance !== undefined){
                // if the element has changed, we need to update some things
                if (element !== instance.element){
                    instance.element = element;
                    instance._on_element_changed(element);

                    // update the element->instance map
                    _instances_by_element.delete(instance.element);
                    _instances_by_element.set(element, instance);
                }

                return instance;
            }

            instance = super.from_element(element);
            this._instances_by_id.set(id, instance);
            return instance;
        }

        _on_element_changed(element){
        }

        get id(){
            return this.constructor._get_id(this.element);
        }
        
        static _get_id(element){
            throw 'this method is abstract';
        }
    });
    IDElementWrapper._instances_by_id = new Map();
    
    /* 
     * Sends an asynchronous xhr GET request
     */
    set_global('async_xhr_get', function async_xhr_get(url, enable_html){
        function make_request(resolve, reject){
            const req = new XMLHttpRequest();
            
            function on_load(e){
                if (req.readyState === 4){
                    if (req.status === 200){
                        resolve(req);
                    } else {
                        reject(req);
                    }
                }
            }
            
            req.addEventListener("load", on_load);
            req.open('GET', url);
            if (enable_html){
                req.responseType = 'document';
            }
            req.send();
        }
        
        return new Promise(make_request);
    });
    
    /* 
     * Sends an asynchronous xhr POST request
     */
    set_global('async_xhr_post', function async_xhr_post(url, data){
        function make_request(resolve, reject){
            const req = new XMLHttpRequest();
            
            function on_load(e){
                if (req.readyState === 4){
                    if (req.status === 200){
                        resolve(req);
                    } else {
                        reject(req);
                    }
                }
            }
            
            req.addEventListener("load", on_load);
            req.open('POST', url);
            req.send(data);
        }
        
        return new Promise(make_request);
    });
    
    /* 
     * Adds a CSS style to the document
     */
    set_global('add_style', function add_style(style){
        const elem = document.createElement('style');
        elem.innerHTML = style;
        document.body.appendChild(elem);
    });
    
    /* 
     * Registers an event handler that's executed *before* the given DOM
     * element's click event is fired
     */
    set_global('before_click', function before_click(predicate, callback, ...arguments){
        if (typeof predicate === 'function'){
            window.addEventListener('click', function(event){
                if (predicate(event)){
                    callback(...arguments);
                }
            }, true);
        } else { // if it's not a callback, it must be an element
            predicate.parentElement.addEventListener('click', function(event){
                if (event.target === predicate){
                    callback(...arguments);
                }
            }, true);
        }
    });
    
    /* 
     * Given a DOM element and a predicate, returns the first parent element
     * for which the predicate returns true
     */
    set_global('find_parent', function find_parent(element, predicate){
        var parent = element;
        while (true){
            parent = parent.parentElement;
            if (parent === null){
                return null;
            }
            
            if (predicate(parent)){
                return parent;
            }
        }
    });
    
    /* 
     * Adds a DOM element above the bottom right corner of another DOM element
     */
    set_global('add_overlay_widget', function add_overlay_widget(base_element, widget){
        var parent = base_element.parentElement;
        const parent_class = '_lib_overlay_menu_parent';
        
        if (!parent.classList.contains(parent_class)){
            // insert a parent element that'll hold the base_element and the menu
            const container = document.createElement('DIV');
            container.classList.add(parent_class);
            
            parent.insertBefore(container, base_element);
            container.appendChild(base_element);
            parent = container;
            
            // now add the menu
            const menu = document.createElement('DIV');
            menu.classList.add('_lib_overlay_menu');
            container.appendChild(menu);
            
            const style = `
._lib_overlay_menu_parent {
    position: relative;
}
        
._lib_overlay_menu {
    z-index: 10;
    position: absolute;
    bottom: 0;
    right: 0;
    margin-right: 0.3em;
    margin-bottom: 0.1em;
    opacity: 0.0;
    cursor: pointer;
    transition: all 0.3s ease-in-out;
}

._lib_overlay_menu:hover {
    opacity: 1.0;
    transition: all 0.3s ease-in-out;
}
`;
            add_style(style);
        }
        
        const menu = parent.lastChild;
        menu.appendChild(widget);
    });
    set_global('add_overlay_button', function add_overlay_button(base_element, button_label, callback){
        const button = document.createElement('A');
        button.textContent = button_label;
        button.style.font_size = 'small';
        button.onclick = callback;
        
        add_overlay_widget(base_element, button);
    });
    
    /* 
     * Creates a MutationObserver that automatically disconnects itself after
     * a certain time of inactivity
     */
    set_global('create_timeout_MutationObserver', function create_timeout_MutationObserver(func, timeout){
        var observer_timeout;
        var observer;
        
        function disconnect(){
            observer.disconnect();
        }
        
        function on_dom_mutation(mutations, observer){
            clearTimeout(observer_timeout);
            observer_timeout = setTimeout(disconnect, timeout);
            
            func(mutations, observer);
        }
        
        observer = new MutationObserver(on_dom_mutation);
        return observer;
    });
    
    /* 
     * Executes a callback function after the given DOM element hasn't been
     * mutated for a certain amount of time
     */
    set_global('run_after_last_mutation', function run_after_last_mutation(func, timeout, element, config){
        if (config === undefined){
            config = {childList: true, subtree: true};
        }
        
        var observer_timeout;
        
        function disconnect(){
            observer.disconnect();
            func();
        }
        
        function on_dom_mutation(mutations, observer){
            clearTimeout(observer_timeout);
            observer_timeout = setTimeout(disconnect, timeout);
        }
        
        const observer = new MutationObserver(on_dom_mutation);
        observer.observe(element, config);
    });
    
    /* 
     * Makes a bunch of DOM elements draggable and reorderable
     */
    set_global('make_dragdrop_reorderable', function make_dragdrop_reorderable(elements, get_id, get_by_id, on_reorder){
        function find_insert_position(x, y, elements){
            let rects = elements.map(e => e.getBoundingClientRect());

            var i = 0;
            for (; i < rects.length; i++){
                let rect = rects[i];

                if (y <= rect.bottom){
                    break;
                }
            }

            for (; i < rects.length; i++){
                let rect = rects[i];
                let center = (rect.x + rect.right) / 2;

                if (x < center){
                    break;
                }
            }
            return i;
        }
        
        function on_drag_start(elem, event){
            let id = get_id(elem);
            event.dataTransfer.setData("text", id);
        }

        function make_draggable(elem){
            elem.draggable = true;
            elem.ondragstart = on_drag_start.bind(null, elem);
        }

        function on_drag_over(event){
            event.preventDefault();
        }

        function on_drop(event){
            let elem_id = event.dataTransfer.getData("text");
            let cur_index = elements.findIndex(e => get_id(e) === elem_id);
            let elem = elements[cur_index];

            let new_index = find_insert_position(event.clientX, event.clientY, elements);

            let parent = elem.parentElement;
            if (new_index !== cur_index){
                if (new_index === elements.length){
                    parent.appendChild(elem);
                } else {
                    parent.insertBefore(elem, elements[new_index]);
                }
                // FIXME: move the element in the `elements` list
            }
            
            on_reorder(elements);

            event.preventDefault();
        }
        
        for (let elem of elements){
            make_draggable(elem);
        }
        
        let parent = elements[0].parentElement;
        parent.ondragover = on_drag_over;
        parent.ondrop = on_drop;
    });
    
    /* 
     * Creates a Promise that's automatically rejected after a certain timeout
     */
    set_global('promise_timeout', function promise_timeout(promise, ms){
      // Create a promise that rejects in <ms> milliseconds
      let timeout = new Promise((resolve, reject) => {
        let id = setTimeout(() => {
          clearTimeout(id);
          reject('Timed out in '+ ms + 'ms.');
        }, ms);
      });

      // Returns a race between our timeout and the passed in promise
      return Promise.race([promise, timeout]);
    });
})();
