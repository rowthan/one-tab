var callback = function(details) {
    var headers = details.responseHeaders;
    for (var i = 0; i < headers.length; ++i) {
        // 移除X-Frame-Options字段
        if (['x-frame-options','content-security-policy'].indexOf(headers[i].name.toLowerCase())>-1) {
            headers.splice(i, 1);
        }
    }
    // 返回修改后的headers列表
    return { responseHeaders: headers };
};
// 监听哪些内容
var filter = {
    urls: ["<all_urls>"]
};
// 额外的信息规范，可选的
var extraInfoSpec = ["blocking", "responseHeaders"];
/* 监听response headers接收事件*/
chrome.webRequest.onHeadersReceived.addListener(callback, filter, extraInfoSpec);


chrome.extension.onRequest.addListener(function (request,sender,sendResponse) {
    switch (request.type) {
        case 'setBadge':
            const badge = request.number ? request.number+'' : ''
            chrome.browserAction.setBadgeText({text:badge,tabId:sender.tab.id})
            chrome.browserAction.setTitle({title:badge?'已合拢'+badge+"个网页":'',tabId:sender.tab.id})
            break;
      case 'autoSort':
        // 平铺模式 TODO 增加多种铺放模式
        autoSort();
        break;
    }
});
//todo active tab 处理后任然需要激活
const autoSort = function() {
  chrome.tabs.query({}, function (tabs) {
    const tabObject = {
      combine:[]
    };
    tabs.forEach((tab)=>{
      const key = getDomain(tab.url) || 'none';
      if(tabObject[key]){
        tabObject[key].push(tab)
      } else {
        tabObject[key] = [tab]
      }
    });

    for(let i in tabObject) {
      if(tabObject[i].length<2 && i!=='combine'){
        tabObject.combine.push(...tabObject[i]);
        delete tabObject[i];
      }
    }


    const windowTabs={}
    for(let i in tabObject){
      if(tabObject[i].length===0) continue;
      const windowObject ={};
      tabObject[i].forEach((tabItem)=>{
        const count = windowObject[tabItem.windowId] || 0;
        windowObject[tabItem.windowId] = count+1;
      });
      let targetWindowId = tabObject[i][0].windowId;
      let maxUseNum = 0;
      for (let w in windowObject){
        if(windowObject[w]>=maxUseNum){
          maxUseNum = windowObject[w];
          targetWindowId = +w;
        }
      }
      // 如果窗口id已经被占用
      if(windowTabs[targetWindowId]){
        targetWindowId = null;
      }else{
        windowTabs[targetWindowId] = tabObject[i];
      }

      const moveTabs = tabObject[i].filter(function(tab){
        return tab.windowId!==targetWindowId;
      }).map((tab)=>{
        return tab.id;
      });
      if(moveTabs.length===0){
        continue;
      }

      //复用没有tab页面的窗口
      if(targetWindowId===null){
        chrome.windows.create({tabId:tabObject[i][0].id}, function(win){
          chrome.tabs.move(moveTabs,{windowId:win.id,index:-1})
        })
      }else {
        chrome.tabs.move(moveTabs,{windowId:targetWindowId,index:-1})
      }
    }
    reMapWindow();
  });
}

const reMapWindow = debounce(function() {
  chrome.windows.getAll({populate:true}, function(result){
    chrome.tabs.query({active:true,currentWindow:true}, function(tabs) {
      const tab = tabs[0];
      const currentId = tab.windowId;
      const windows = result.filter((item)=>{
        return item.tabs.length>0
      }).sort(function(window,next){
        return  next.tabs.length-window.tabs.length
      }).sort(function(window){
        return window.id===currentId?1:-1
      });

      let firstWindow = {
        width: window.screen.availWidth-(windows.length-1)*setting.distanceLeft,
        height: window.screen.availHeight,
        left: window.screen.availLeft,
        top: window.screen.availTop,
      };

      // (function updateWindow(windows,{top,left,width,height},index){
      //
      //   chrome.windows.update(item.id, {top,left,width,height,focused:true},function () {
      //     updateWindow()
      //   })
      // })(windows,{top:0, left:0, screenWidth,screenHeight},0);
      if(windows.length===0) return;
      // chrome.windows.update(windows[windows.length-1].id,
      //   {
      //     top:firstWindow.top,
      //     left:firstWindow.left,
      //     width:firstWindow.width-(windows.length-1)*setting.distanceLeft,
      //     height:firstWindow.height,focused:false,drawAttention:false},function (result) {
      //   firstWindow = result;
      //     mapWindow();
      // });

      mapWindow();
      function mapWindow() {
        canMap = false;
        let count = windows.length;
        windows.forEach((item,index)=>{
          const top = index*setting.distanceTop+firstWindow.top;
          const left = firstWindow.left //+index*setting.distanceLeft;
          const width =  firstWindow.width;
          const height = firstWindow.height-index*setting.distanceTop;
          // console.log(item.id,[top,left,width,height],index);
          chrome.windows.update(item.id, {top,left,width,height,focused:true,drawAttention:true},function () {
            count--;
            if(count===0){
              canMap = true;
            }
          })
        })
      }
    })
  });
},200)


const setting = {
    moveToCurrentWindow: true,
    distanceTop: 34,
    distanceLeft: window.screen.availWidth>1200?24:16,
    matchExact: false,
};

const newTabUrl = 'chrome://newtab/';


chrome.tabs.onUpdated.addListener(function(tabId,changeInfo,tab) {
    if(changeInfo.status!=='loading') {
      return
    };
    const valid = tab.url.indexOf('http') > -1;
    if(!valid){
        chrome.browserAction.setIcon({
          path:'images/icon-32-disable.png',
          tabId:tab.id
        });
    }
    else{
        chrome.browserAction.setIcon({
          path:'images/icon-32.png',
          tabId:tab.id
        })
    }

    chrome.tabs.query({}, function (result){
        const checkMult = +localStorage.getItem('preventMult')===1;
        if(!checkMult){
          return;
        }
        let index = undefined;
        let targetWindowId = undefined;
        let targetTabId = undefined;
        for(let i=0;i<result.length;i++){
          const item = result[i];
          if(item.url===tab.url && tab.url!==newTabUrl && item.id!==tab.id){
            index = item.index;
            targetWindowId = item.windowId;
            targetTabId = item.id;
            break;
          }
        }

        if(!targetWindowId||index===undefined||!targetTabId) return;

        if(setting.moveToCurrentWindow){
          chrome.tabs.move(targetTabId, {windowId:tab.windowId,index:tab.index},function (result) {
            chrome.tabs.remove([tab.id]);
            chrome.tabs.highlight({windowId:tab.windowId,tabs:[tab.index]})
          });
        } else{
          chrome.windows.update(targetWindowId, {focused:true},function(){
            chrome.tabs.highlight({windowId:targetWindowId, tabs:[index]},function () {
              chrome.tabs.remove([tabId])
            });
          })
        }

      // chrome.tabs.captureVisibleTab(result[0].windowId,{}, function(result){
      //     // console.log('image',result)
      // })

    });
});


function getDomain(url){
   const matchresult =  (url.match(/^https?:\/\/.*?\.?([^\/]*)/i)||[])[1]||'';
   const hostArray = matchresult.split('.');
   // 模糊匹配，只取顶级域名
   if(hostArray.length>2 && !setting.matchExact){
     return hostArray.slice(hostArray.length-2).join('.');
   }

   return matchresult;
}

chrome.browserAction.onClicked.addListener(function(tab) {
  autoSort()
});
let canMap = true;
chrome.windows.onFocusChanged.addListener(function(window){
  if(window===-1) return;
  if(canMap){
    reMapWindow();
  }
});
function debounce(func, wait) {
  let timeout;
  return function () {
    let context = this;
    let args = arguments;

    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      func.apply(context, args)
    }, wait);
  }
}
chrome.tabs.onActivated.addListener(function (tab) {
  // console.log('tab change',tab)
  // reMapWindow()
})
chrome.tabs.onDetached.addListener(function(){
  // console.log('detached')
  // canMap = false;
})
chrome.tabs.onAttached.addListener(function () {
  // console.log('onattached')
  // canMap = true
})

/**菜单*/
chrome.contextMenus.create({"title": '智能整理窗口', "contexts":["all", "page", "frame"] ,
  "onclick": autoSort});

const defaultPrevent = localStorage.getItem('preventMult')!==0;
var doPrevent = chrome.contextMenus.create(
  {"title": "开启防重复页面模式", "type": "radio",checked:defaultPrevent, "onclick":checkboxOnClick});
var checkbox2 = chrome.contextMenus.create(
  {"title": "关闭防重复页面模式", "type": "radio",checked:!defaultPrevent, "onclick":checkboxOnClick});

function checkboxOnClick(info,tab) {
  localStorage.setItem('preventMult',info.menuItemId===doPrevent?1:0);
}
/**菜单end**/

chrome.commands.onCommand.addListener(function(command) {
  if(command === 'clear-up-window'){
    autoSort()
  }
});
