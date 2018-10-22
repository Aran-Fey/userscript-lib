(function(){
    function set_global(name, value){
        window[name] = value;
        
        if (typeof unsafeWindow !== 'undefined')
            unsafeWindow[name] = value;
    }
    function get_global(name){
        var value = window[name];
        if (value !== undefined)
            return value;
        
        if (typeof unsafeWindow === 'undefined')
            return undefined;
        
        return unsafeWindow[name];
    }
    
    if (get_global('USlib') !== undefined)
        return;
    set_global('USlib', true);
    
    set_global('set_global', set_global);
    set_global('get_global', get_global);
    
    set_global('UserScript', class UserScript {
        static getValue(name, default_){
            if (typeof GM_getValue !== 'undefined')
                return new Promise(function(resolve, reject) {
                    resolve(GM_getValue(name, default_));
                });
            else
                return GM.getValue(name, default_);
        }
        
        static setValue(name, value){
            if (typeof GM_setValue !== 'undefined')
                return new Promise(function(resolve, reject) {
                    resolve(GM_setValue(name, value));
                });
            else
                return GM.setValue(name, value);
        }
    });
    
    set_global('BaseClass', class BaseClass {
        clone(){
            return Object.create(this);
        }
        
        is_a(cls){
            return this.constructor === cls;
        }
        is_any(classes){
            for (const cls of classes){
                if (this.is_a(cls))
                    return true;
            }
            return false;
        }
    });
    
    set_global('keyed_sort', function(arr, keyfunc){
        const keyedArr = arr.map(obj => [keyfunc(obj), obj]);
        keyedArr.sort((a, b) => a[0] - b[0])
        
        return keyedArr.map(pair => pair[1]);
    });
    
    const _instances_by_element = new Map();
    set_global('ElementWrapper', class extends BaseClass {
        constructor(element){
            super();
            this.element = element;
        }

        static from_element(element){
            var instance = _instances_by_element.get(element);
            if (instance !== undefined)
                return instance;

            instance = new this(element);
            _instances_by_element.set(element, instance);
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
    
    set_global('IDElementWrapper', class extends ElementWrapper {
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
    });
    IDElementWrapper._instances_by_id = new Map();
    
    set_global('async_xhr_get', function(url, enable_html){
        function make_request(resolve, reject){
            const req = new XMLHttpRequest();
            
            function on_load(e){
                if (req.readyState === 4){
                    if (req.status === 200)
                        resolve(req);
                    else
                        reject(req);
                }
            }
            
            req.addEventListener("load", on_load);
            req.open('GET', url);
            if (enable_html)
                req.responseType = 'document';
            req.send();
        }
        
        return new Promise(make_request);
    });
    
    set_global('async_xhr_post', function(url, data){
        function make_request(resolve, reject){
            const req = new XMLHttpRequest();
            
            function on_load(e){
                if (req.readyState === 4){
                    if (req.status === 200)
                        resolve(req);
                    else
                        reject(req);
                }
            }
            
            req.addEventListener("load", on_load);
            req.open('POST', url);
            req.send(data);
        }
        
        return new Promise(make_request);
    });
    
    set_global('add_style', function(style){
        const elem = document.createElement('style');
        elem.innerHTML = style;
        document.body.appendChild(elem);
    });

    set_global('before_click', function(predicate, callback, ...arguments){
        if (typeof predicate === 'function'){
            window.addEventListener('click', function(event){
                if (predicate(event))
                    callback(...arguments);
            }, true);
        } else { // if it's not a callback, it must be an element
            predicate.parentElement.addEventListener('click', function(event){
                if (event.target === predicate)
                    callback(...arguments);
            }, true);
        }
    });

    set_global('find_parent', function(element, predicate){
        var parent = element;
        while (true){
            parent = parent.parentElement;
            if (parent === null)
                return null;
            
            if (predicate(parent))
                return parent;
        }
    });

    set_global('add_overlay_widget', function(base_element, widget){
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
    set_global('add_overlay_button', function(base_element, button_label, callback){
        const button = document.createElement('A');
        button.textContent = button_label;
        button.style.font_size = 'small';
        button.addEventListener('click', callback);
        
        add_overlay_widget(base_element, button);
    });

    set_global('create_timeout_MutationObserver', function(func, timeout){
        var observer_timeout;
        var observer;
        
        function disconnect(){
            observer.disconnect();
            // console.log('observer disconnected');
        }
        
        function on_dom_mutation(mutations, observer){
            clearTimeout(observer_timeout);
            observer_timeout = setTimeout(disconnect, timeout);
            
            func(mutations, observer);
        }
        
        observer = new MutationObserver(on_dom_mutation);
        return observer;
    });

    set_global('run_after_last_mutation', function(func, timeout, element, config){
        if (config === undefined)
            config = {childList: true, subtree: true};
        
        var observer_timeout;
        
        function disconnect(){
            observer.disconnect();
            // console.log('observer disconnected');
            func();
        }
        
        function on_dom_mutation(mutations, observer){
            clearTimeout(observer_timeout);
            observer_timeout = setTimeout(disconnect, timeout);
        }
        
        const observer = new MutationObserver(on_dom_mutation);
        observer.observe(element, config);
    });

    set_global('make_dragdrop_reorderable', function(elements, get_id, get_by_id, on_reorder){
        function find_insert_position(x, y, elements){
            let rects = elements.map(e => e.getBoundingClientRect());

            var i = 0;
            for (; i < rects.length; i++){
                let rect = rects[i];

                if (y <= rect.bottom)
                    break;
            }

            for (; i < rects.length; i++){
                let rect = rects[i];
                let center = (rect.x + rect.right) / 2;

                if (x < center)
                    break;
            }
            return i;
        }
        
        function on_drag_start(elem, event){
            let id = get_id(elem);
            event.dataTransfer.setData("text", id);
        }

        function make_draggable(elem){
            elem.draggable = true;
            elem.addEventListener('dragstart', on_drag_start.bind(null, elem));
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
                if (new_index === elements.length)
                    parent.appendChild(elem);
                else
                    parent.insertBefore(elem, elements[new_index]);
                // FIXME: move the element in the `elements` list
            }
            
            on_reorder(elements);

            event.preventDefault();
        }
        
        for (let elem of elements)
            make_draggable(elem);
        
        let parent = elements[0].parentElement;
        parent.addEventListener('dragover', on_drag_over);
        parent.addEventListener('drop', on_drop);
    });

    set_global('promise_timeout', function(promise, ms){
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
