const keys={
    framesInfo:{
        key:'one-tab-covers',
        default:function () {
            return []
        }
    },
    mainPage: {
        key:'one-tab-covers-main',
        default: function () {
            return {
                alpha:1,
                activeIndex:-1,
                showButton: true,
                showType:'overlap',
            }
        }
    }
}

const PAGEACTIONS = {
    SECURITY_KEY:'onetabmorepagepostmessagekey',
    CHANGE_COLOR:'changeColor',
    ACTIVE_FRAME:'activeFrame',
    SAVE_FAVICON:'saveFrameFavicon',
    INHERIT_INFO:'inheritFrameInfo',
    REFRESH:'refreshPage'
}


function debounce(fun,timeout) {
    let timer = null;
    let arguments = [];
    return (...arg)=>{
        arguments = arg;
        if(!timer){
            timer = setTimeout(()=>{
                fun && fun.apply(null,arguments)
                timer = null;
            },timeout)
        }
    }
}

const dom = {
    changeAlpha: debounce(function(rate) {
        if(rate<=0){
            document.body.style.display='none'
            return
        }else{
            document.body.style.display= document.body.dataset.originDisplay;
        }
        let bkCount = 0;


        [].forEach.call(document.querySelectorAll("*"),function(element){
            const opacity = element.dataset.opacity || dom.getStyle(element,'opacity') || 1
            const originbkImage = element.dataset.originBKImage || dom.getStyle(element,'background-image');
            const imageUrlReg = /url/;
            // TODO 避免 opacity 叠加
            const canChangeOpacity = originbkImage && element.childNodes.length < 2
            if(element.tagName==="IMG"){
                element.dataset.opacity = opacity
                element.style.opacity = opacity * rate
            }
            if(originbkImage){
                element.dataset.originBKImage = originbkImage;
            }

            const originBKColor = element.dataset.originBKColor || dom.getStyle(element,'background-color').toString();
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
    },200),
    activePage: function (pageIndex=-1,framesInfo=[],showButton=false,mainAlpha=1) {
        const frames = dom.getFrames();
        pageIndex = pageIndex >= frames.length? -1: pageIndex
        document.body.style.zIndex = frames.length;

        const position = dom.getStyle(document.body,'position');

        // if(!position || position==='static'){
        //     document.body.style.position = 'relative'
        // }

        [].forEach.call(frames,function (frame,index) {
            frame.style.zIndex = index;
            if(index === pageIndex){
                frame.style.zIndex = frames.length+1;
            }
        })

        initButton()

        function initButton() {
            let asideContainer = document.getElementById('frame-button-container') || document.createElement('aside');
            asideContainer.innerHTML='';
            if(framesInfo.length<1 || !showButton){
                return;
            }

            asideContainer.id = 'frame-button-container';
            document.documentElement.insertBefore(asideContainer,document.body)

            const handle = document.createElement('input')
            handle.setAttribute("type","range");
            handle.setAttribute("max",100);
            handle.setAttribute("min",-1);
            const value = pageIndex === -1 ? mainAlpha*100 : framesInfo[pageIndex].alpha * 100
            handle.setAttribute("value",value);
            handle.oninput= function(event){
                const alpha = event.target.value / 100.00;
                setAlpha(pageIndex,alpha)
            }
            asideContainer.appendChild(handle);


            framesInfo.forEach(function (cover,index) {
                const container = document.createElement('div')
                const button = document.createElement('button')
                button.className='one-tab-page-switch-button'
                button.innerText = cover.src.substr(0,25);
                button.onclick=function(){
                    setActive(index)
                }
                if(pageIndex === index){
                    button.classList.add('active-frame-button')
                }
                container.appendChild(button)
                const refreshButton = document.createElement('button');
                refreshButton.innerText = '刷新'
                refreshButton.onclick = function(){
                    dom.getFrames()[index].contentWindow.postMessage({
                        type: PAGEACTIONS.REFRESH,
                        securityKey: PAGEACTIONS.SECURITY_KEY
                    },"*");
                }
                container.appendChild(refreshButton);
                asideContainer.appendChild(container)
            })
            const button = document.createElement('button')
            button.innerText = window.location.href;
            button.className='one-tab-page-switch-button'
            button.onclick=function(){
                setActive(-1)
            }
            if(pageIndex === -1){
                button.classList.add('active-frame-button')
            }
            asideContainer.appendChild(button)
        }
    },
    getStyle:function(elem, property){
        if(!elem || !property){
            return false;
        }

        let value = elem.style[camelize(property)], // 先获取是否有内联样式
            css; // 获取的所有计算样式
        // 无内联样式，则获取层叠样式表计算后的样式
        if(!value){
            if(document.defaultView && document.defaultView.getComputedStyle){
                css = document.defaultView.getComputedStyle(elem, null);
                value = css ? css.getPropertyValue(property) : null;
            }
        }
        return value;

        // 字符串转换为驼峰写法
        function camelize(str) {
            return str.replace(/-(\w)/g, function (strMatch, p1){
                return p1.toUpperCase();
            });
        }
    },
    // 动态获取
    getFrames:function () {
        return document.getElementsByClassName('iframe-cover')
    },
    getFavicon: function () {
        const favicon = document.head.querySelector("link[rel~='icon']") || document.head.querySelector("link[rel~='shortcut']") ||  {}
        return favicon.href || '';
    }
}

const getStorage = function (key=keys.framesInfo.key) {
    let storage = null;
    switch (key) {
        case keys.framesInfo.key:
            storage = keys.framesInfo.default()
            break;
        case keys.mainPage.key:
            storage = keys.mainPage.default()
            break;
        default:
            return storage
    }
    try{
        const st = sessionStorage.getItem(key);
        storage =  st ? JSON.parse(st) : setStorage(storage,key)
    }catch (e) {
        console.error(e)
    }
    return storage;
}

const setStorage = function (value,key=keys.framesInfo.key) {
    sessionStorage.setItem(key,JSON.stringify(value))
    switch (key) {
        case keys.mainPage.key:
            dom.changeAlpha(value.alpha)
            break
    }
    return value
}

const modifyFrameInfo = function(index,value){
    const frames = getStorage(keys.framesInfo.key)
    frames.splice(index,1,value)
    setStorage(frames,keys.framesInfo.key)
    const target = dom.getFrames()[value.frameIndex].contentWindow
    target.postMessage({type:PAGEACTIONS.INHERIT_INFO,frameInfo:value,securityKey:PAGEACTIONS.SECURITY_KEY},"*");
}

window.addEventListener('keyup',function (e) {
    const tagName = e.target.tagName;
    if(["INPUT","TEXTAREA"].indexOf(tagName)>-1 || e.target.isContentEditable){
        return;
    }
    const number =  e.keyCode-49;
    if(number>=-1){
        if(!isOriginWindow){
            window.top.postMessage({
                type: PAGEACTIONS.ACTIVE_FRAME,
                activeIndex: number,
                securityKey: PAGEACTIONS.SECURITY_KEY
            },"*")
            return
        }
        setActive(number)
    }else if([37,39].indexOf(e.keyCode)>-1){
        const step = (38-e.keyCode) * 0.1
        console.log(step)
    }
})

const isOriginWindow = window.top === window;
if(isOriginWindow){
    initFrames();
    const frames = getStorage(keys.framesInfo.key);
    window.addEventListener('load', function(){
        frames.forEach((item,index)=>
            dom.getFrames()[index].contentWindow.postMessage({
                type: PAGEACTIONS.INHERIT_INFO,
                frameInfo:Object.assign(item,{frameIndex:index}),
                securityKey: PAGEACTIONS.SECURITY_KEY
        },"*"));
        const mainInfo = getStorage(keys.mainPage.key)
        mainInfo.favicon = dom.getFavicon();
        mainInfo.title = document.title
        mainInfo.url = window.location.href
        setStorage(mainInfo,keys.mainPage.key)
    })

    // 监听来自popup的指令
    chrome.extension.onMessage.addListener(
        function(request, sender, sendResponse) {
            switch (request.type) {
                case 'addFrames':
                    const frames = request.frames;
                    const mainProtocol = window.location.protocol;
                    // if(src.indexOf(mainProtocol)===-1){
                    //     sendResponse({success:false,errMsg:`主页协议为${mainProtocol},无法添加http协议网站。请访问http协议网站后，添加http网址`})
                    //     return;
                    // }
                    const tempFrames = [];
                    frames.forEach((frame)=>{
                        tempFrames.push({
                            src:frame.url,
                            favicon:frame.favicon,
                            alpha:1,
                        })
                    });

                    let originF = getStorage();
                    originF = originF.concat(tempFrames);
                    setStorage(originF)
                    setActive(originF.length-1);
                    initFrames()
                    sendResponse({success:true})
                    break;
                case 'getInfos':
                    sendResponse({
                        frames:getStorage(),
                        mainPage:getStorage(keys.mainPage.key,{}),
                        success:true
                    })
                    break;
                case 'setActive':
                    const activeIndex = request.activeIndex;
                    setActive(activeIndex)
                    sendResponse({success: true})
                    break;
                case 'setAlpha':
                    setAlpha(request.frameIndex,request.alpha);
                    sendResponse({success:true})
                    break;
                case 'deleteFrame':
                    const removeIndex = request.frameIndex;
                    const current = getStorage();
                    current.splice(removeIndex,1);
                    setStorage(current)
                    initFrames()
                    sendResponse({success:true})
                    break;
                case 'toggleShowButton':
                    const storage = getStorage(keys.mainPage.key,{});
                    storage.showButton = !storage.showButton;
                    setStorage(storage,keys.mainPage.key)
                    setActive()
                    sendResponse({success:true})
                    break;
                case 'closeOthers':
                    setStorage([]);
                    initFrames();
                    sendResponse({success:true});
                    break;
                case 'changeType':
                    const mainInfo = getStorage(keys.mainPage.key);
                    mainInfo.showType = request.showType
                    setStorage(mainInfo,keys.mainPage.key);
                    const iframes = dom.getFrames();
                    switch (request.showType) {
                        case 'flat':
                            [].forEach.call(iframes,(iframe)=>{
                                iframe.style.position='relative'
                            })
                            break;
                        case 'overlap':
                            [].forEach.call(iframes,(iframe)=>{
                                iframe.style.position='absolute'
                            })
                            break;
                        default:
                            console.warn('未知类型的布局方式')
                    }
                    sendResponse({success:true})
                    break;
                default:
                    sendResponse({success:false,errMsg:'未知类型的命令'})
            }
        }
    );

    function initFrames() {
        // TODO 修改title 显示当前激活项
        // TODO 新增时 不影响其他frame再次加载
        [].forEach.call(document.querySelectorAll('.iframe-cover'), (frame)=> frame.parentElement.removeChild(frame));
        const frames = getStorage();
        // const maxLength = Math.max(currentFrames.length,frames.length);
        // for(let frameIndex=0; frameIndex <= maxLength; frameIndex++){
        //     const tempCurrent = currentFrames[frameIndex] || {};
        //     if(tempCurrent.src !== frames.src){
        //         tempCurrent.parentElement.removeChild(tempCurrent);
        //         addFrameToHTML(frames)
        //     }
        // }
        //
        // [].forEach.call(currentFrames, (frame)=> frame.parentElement.removeChild(frame));
        frames.forEach((cover)=> addFrameToHTML(cover.src));
        chrome.extension.sendRequest({type: "setBadge",number:frames.length})
        function addFrameToHTML(src){
            const iframe = document.createElement('iframe');
            iframe.src = src;
            iframe.className = 'iframe-cover';
            const isAbsolute = getStorage(keys.mainPage.key).showType==="flat" ? "relative" : "absolute"
            iframe.style.position = isAbsolute
            document.documentElement.appendChild(iframe);
        }
        const mainInfo = getStorage()
        setActive(mainInfo.activeIndex);
    }

    function setActive(activeIndex=getStorage(keys.mainPage.key).activeIndex){
        const framesInfo = getStorage(keys.framesInfo.key)
        const storage = getStorage(keys.mainPage.key)
        storage.activeIndex = activeIndex
        setStorage(storage,keys.mainPage.key)
        dom.activePage(activeIndex,framesInfo,storage.showButton,storage.alpha);
    }

    function setAlpha(frameIndex,alpha) {
        if(frameIndex===-1){
            const storage = getStorage(keys.mainPage.key)
            storage.alpha = alpha;
            setStorage(storage,keys.mainPage.key)
        }else{
            const frame = getStorage()[frameIndex]
            frame.alpha = alpha
            frame.frameIndex = frameIndex
            modifyFrameInfo(frameIndex,frame)
        }
    }

    // 监听来自 frame 发送的请求
    window.addEventListener('message',function(e){
        if(e.data.securityKey!==PAGEACTIONS.SECURITY_KEY){
            return;
        }
        switch (e.data.type) {
            case PAGEACTIONS.ACTIVE_FRAME:
                setActive(e.data.activeIndex)
                break
            case PAGEACTIONS.SAVE_FAVICON:
                const stora = getStorage()
                stora[e.data.frameIndex].favicon = e.data.favicon;
                stora[e.data.frameIndex].title = e.data.title;
                setStorage(stora)
                break;
            default:
                console.warn('监听到来自frame未知'+JSON.stringify(e.data))
        }
    },false);
} else {
    // 监听来自 主页 发送的命令
    window.addEventListener('message',function(e){
        if(e.data.securityKey!==PAGEACTIONS.SECURITY_KEY){
            return
        }
        switch (e.data.type) {
            case PAGEACTIONS.CHANGE_COLOR:
                const alpha = e.data.alpha || 0.1
                dom.changeAlpha(alpha)
                break;
            case PAGEACTIONS.INHERIT_INFO:
                setStorage(e.data.frameInfo,keys.mainPage.key)
                break;
            case PAGEACTIONS.REFRESH:
                window.location.reload()
                break;
            default:
                console.warn('监听到未知类型请求：'+e.data.type)
        }
    },false);

    window.addEventListener('load',function () {
        const frameInfo = getStorage(keys.mainPage.key);
        const favicon = dom.getFavicon()
        if(favicon && frameInfo.frameIndex!==undefined) {
            window.top.postMessage({
                type: PAGEACTIONS.SAVE_FAVICON,
                favicon:favicon,
                title: document.title,
                frameIndex:frameInfo.frameIndex,
                securityKey: PAGEACTIONS.SECURITY_KEY
            },"*")
        }
    })
}
window.addEventListener('load',function () {
    document.body.dataset.originDisplay = dom.getStyle(document.body,'display');
    document.body.dataset.originPosition = dom.getStyle(document.body,'position');
    const pageInfo = getStorage(keys.mainPage.key);
    dom.changeAlpha(pageInfo.alpha||1);
})



