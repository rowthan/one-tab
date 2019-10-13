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


          const windowTabs={

          }

          for(let i in tabObject){
            if(tabObject[i].length===0) continue;
            let targetWindowId = tabObject[i][0].windowId;
            // 如果窗口id已经被占用
            if(windowTabs[targetWindowId]){
              targetWindowId = null;
            }else{
              windowTabs[targetWindowId] = tabObject[i];
            }

            const tabIds = tabObject[i].map((tab)=>{
              return tab.id;
            });
            const moveTabs = tabIds.slice(1);
            if(moveTabs.length===0){
              delete tabObject[i]
              continue;
            }

            if(targetWindowId===null){
              chrome.windows.create({tabId:tabObject[i][0].id}, function(win){
                chrome.tabs.move(moveTabs,{windowId:win.id,index:-1},function (result) {
                  delete tabObject[i]
                  if(Object.keys(tabObject).length===0){
                    reMapWindow()
                  }
                })
              })
            }else {
              chrome.tabs.move(moveTabs,{windowId:targetWindowId,index:-1},function (result) {
                delete tabObject[i]
                if(Object.keys(tabObject).length===0){
                  reMapWindow()
                }
              })
            }
          }
        });
        break;
    }
});

const reMapWindow = function() {
  chrome.windows.getAll({populate:true}, function(result){
    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;
    chrome.tabs.getSelected(null, function(tab) {
      const currentId = tab.windowId;
      const windows = result.filter((item)=>{
        return item.tabs.length>0
      }).sort(function(window,next){
        return  next.tabs.length-window.tabs.length
      }).sort(function(window){
        return window.id===currentId?1:-1
      })
      windows.forEach((item,index)=>{
        const top = index*34+window.screen.availTop;
        const left = index*16;
        const width =  screenWidth-left-(windows.length-index)*14;
        const height = screenHeight;
        try{
          chrome.windows.update(item.id, {top,left,width,height,focused:true})
        }catch (e) {
          console.log(e,'update')
        }
      })
    })
  });
}


const setting = {
    moveToSameWindow: false,
};

const newTabUrl = 'chrome://newtab/';

const tabRef = {}

chrome.tabs.onUpdated.addListener(function(tabId,changeInfo,tab) {
    if(changeInfo.status!=='loading') {
      return
    };
    if(tab.openerTabId){
        tabRef[tabId] = tab.openerTabId;
    }
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

        if(setting.moveToSameWindow){
          chrome.tabs.move(targetTabId, {windowId:tab.windowId,index:tab.index},function (result) {
            chrome.tabs.remove([tab.id]);
            chrome.tabs.highlight({windowId:tab.windowId,tabs:[tab.index]})
          });
        }
        chrome.windows.update(targetWindowId, {focused:true},function(){
          chrome.tabs.highlight({windowId:targetWindowId, tabs:[index]},function () {
            chrome.tabs.remove([tabId])
          });
        })

      // chrome.tabs.captureVisibleTab(result[0].windowId,{}, function(result){
      //     // console.log('image',result)
      // })

    });
});


function getDomain(url){
   const matchresult =  (url.match(/^https?:\/\/.*?\.?([^\/]*)/i)||[])[1]||'';
   const hostArray = matchresult.split('.');
   if(hostArray.length>2){
     return hostArray.slice(hostArray.length-2).join('.');
   }

   return matchresult;

}
