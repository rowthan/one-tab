// 存储基础方法
const getStorage = function (key='one-tab-covers',defaultValue=[]) {
    let storage = defaultValue
    try{
        const st = sessionStorage.getItem(key);
        storage =  st ? JSON.parse(st) : setStorage(defaultValue,key)
    }catch (e) {
        console.error(e)
    }
    return storage;
}

const setStorage = function (value,key='one-tab-covers') {
    sessionStorage.setItem(key,JSON.stringify(value))
    return value
}



const addFrameToStorage = function (frame) {
    let storage = getStorage();
    storage.push(frame);
    setStorage(storage)
    initFrames()
}


const isOriginWindow = window.top === window

if(isOriginWindow){
    window.addEventListener('keyup',function (e) {
        // TODO 更多类型可输入区判断
        if(e.target.tagName!=="INPUT"){
            const number =  e.keyCode-49;
            if(number>=-1){
                setActive(number)
            }else if([37,39].indexOf(e.keyCode)>-1){
                const step = (38-e.keyCode) * 0.1

            }
        }
    })
    const defaultMain = {
        alpha:1,
    }
    const mainInfo = getStorage('one-tab-covers-main',defaultMain)

    // 载入frame
    initFrames();
    // 初始化 button
    window.onload = function(){
        changeAlpha(mainInfo.alpha)
        // 通知frame
        getStorage().forEach(function (item,index) {
            callSetAlpha(index,item.alpha)
        })
    }
    window.addEventListener("hashchange", function () {
        console.log('hashchanged')
        changeAlpha(mainInfo.alpha)
    }, false);

    // 监听来自popup的指令
    chrome.extension.onMessage.addListener(
        function(request, sender, sendResponse) {
            switch (request.type) {
                case 'addFrame':
                    const src = request.data;
                    const mainProtocol = window.location.protocol;
                    console.log(mainProtocol)
                    if(src.indexOf(mainProtocol)===-1){
                        sendResponse({success:false,errMsg:`主页协议为${mainProtocol},无法添加http协议网站。请访问http协议网站后，添加http网址`})
                        return;
                    }

                    addFrameToStorage({
                        src:src,
                        alpha:1,
                    })
                    sendResponse({success:true})
                    break;
                case 'getInfos':
                    sendResponse({frames:getStorage(),mainPage:getStorage('one-tab-covers-main',{})})
                    break;
                case 'setActive':
                    const activeIndex = request.activeIndex;
                    setActive(activeIndex)
                    sendResponse({success: true})
                    break;
                case 'setAlpha':
                    if(request.frameIndex===-1){
                        const storage = getStorage('one-tab-covers-main')
                        storage.alpha = request.alpha;
                        setStorage(storage,'one-tab-covers-main')
                        sendResponse({success:true})
                        changeAlpha(request.alpha)
                    }else{
                        const storage = getStorage()
                        storage[request.frameIndex].alpha = request.alpha
                        setStorage(storage);
                        sendResponse({success:true})
                        callSetAlpha(request.frameIndex,request.alpha)
                    }
                    break;
                case 'deleteFrame':
                    const removeIndex = request.frameIndex;
                    const current = getStorage();
                    current.splice(removeIndex,1);
                    setStorage(current)
                    initFrames()
                    sendResponse({success:true})
                    break;
                default:
                    console.warn('监听到未知类型请求：'+request.type)
            }
        }
    );
} else {
    // 监听来自 主页 发送的命令
    window.addEventListener('message',function(e){
        switch (e.data.type) {
            case 'changeColor':
                const alpha = e.data.alpha || 0.1
                changeAlpha(alpha)
                break;
        }
    },false);
}



function initFrames() {
    // 删除所有 frame
    const frames = document.querySelectorAll('.iframe-cover');
    [].forEach.call(frames, (frame,index)=> {
        frame.parentElement.removeChild(frame)
    })

    // 初始化
    const covers = getStorage();
    let hasMain = false
    let hasFrame = false
    covers.forEach(function (cover) {
        addFrameToHTML(cover.src)
        // if(cover.isMain){
        //     hasMain = true
        // }else{
        //     hasFrame = true
        // }
    })

    setActive()
    // // 存在主页，且存在frame
    // if(hasMain && hasFrame){
    //     document.body.style.display = 'none'
    // }
    // // 不存在主页，存在 frame
    // if(hasFrame && !hasMain) {
    //     covers.push({
    //         src: window.location.href,
    //         isMain:true,
    //         alpha:1
    //     })
    //     setStorage(covers)
    //     initFrames()
    // }

    function addFrameToHTML(src){
        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.className = 'iframe-cover';
        document.documentElement.insertBefore(iframe,document.body);
    }
}

function setActive(activeIndex=getStorage('one-tab-covers-main').activeIndex){
    const frames = document.getElementsByClassName('iframe-cover');
    activeIndex = activeIndex >= frames.length? -1: activeIndex
    document.body.style.zIndex = frames.length;
    // TODO 使用原始值
    // document.body.style.display = 'inherit'
    const position = getStyle(document.body,'position');

    if(!position || position==='static'){
        document.body.dataset.originPosition = position;
        document.body.style.position = 'relative'
    }

    [].forEach.call(frames,function (frame,index) {
        frame.style.zIndex = index;
        if(index === activeIndex){
            frame.style.zIndex = frames.length+1;
        }
    })


    const storage = getStorage('one-tab-covers-main')
    storage.activeIndex = activeIndex
    setStorage(storage,'one-tab-covers-main')

    initButton()

    function initButton() {
        let asideContainer = document.getElementById('frame-button-container') || document.createElement('aside');
        asideContainer.innerHTML='';
        const covers = getStorage();
        if(covers.length<1){
            return;
        }

        asideContainer.id = 'frame-button-container';
        document.documentElement.insertBefore(asideContainer,document.body)




        covers.forEach(function (cover,index) {
            const button = document.createElement('button')
            button.innerText = cover.src;
            button.onclick=function(){
                setActive(index)
            }
            if(getStorage('one-tab-covers-main').activeIndex === index){
                button.className='active-frame-button'
            }
            asideContainer.appendChild(button)
        })
        const button = document.createElement('button')
        button.innerText = window.location.href;
        button.onclick=function(){
            setActive(-1)
        }
        if(getStorage('one-tab-covers-main').activeIndex === -1){
            button.className='active-frame-button'
        }
        asideContainer.appendChild(button)
    }

}

function callSetAlpha(frameIndex,alpha){
    const data = {
                    type:'changeColor',
                    alpha:alpha,
                    sender:window.location.href,
                }
    window.frames[frameIndex].postMessage(data,'*')
}




function changeAlpha(rate,parentTarget = document) {
    if(rate<=0){
        document.body.style.display='none'
        return
    }else{
        document.body.style.display='inherit'
    }
    let bkCount = 0;

    [].forEach.call(parentTarget.querySelectorAll("*"),function(element){
        const originBKColor = element.dataset.originBKColor || getStyle(element,'background-color').toString();
        const colorRegx = /rgba?\((\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*.*?)\)/
        const matchResult = originBKColor.match(colorRegx) || [];
        if(matchResult.length){
            const colorArray = matchResult[1].split(",")
            const r = colorArray[0];
            const g = colorArray[1];
            const b = colorArray[2];
            const a = colorArray[3]===undefined ? 1 : colorArray[3].trim();
            if(a!=='0'){
                element.dataset.originBKColor = originBKColor
                element.style.backgroundColor = `rgba(${r},${g},${b},${rate * (a)})`
                // element.style.outline="1px solid #"+(~~(Math.random()*(1<<24))).toString(16)
                element.style.outline = '1px solid rgb(187,226,144,'+ (1-rate) * (a)+')'
                bkCount++
            }
        }
    })
    console.log('count:'+bkCount)
}


// 获取元素计算后的样式
function getStyle(elem, property){
    if(!elem || !property){
        return false;
    }

    var value = elem.style[camelize(property)], // 先获取是否有内联样式
        css; // 获取的所有计算样式

    // 无内联样式，则获取层叠样式表计算后的样式
    if(!value){
        if(document.defaultView && document.defaultView.getComputedStyle){
            css = document.defaultView.getComputedStyle(elem, null);
            value = css ? css.getPropertyValue(property) : null;
        }
    }

    return value;
}

// 字符串转换为驼峰写法
function camelize(str) {
    return str.replace(/-(\w)/g, function (strMatch, p1){
        return p1.toUpperCase();
    });
}
