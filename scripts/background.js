const setting = {
  maxWindow:4,
  tabMax: 11,
  moveToCurrentWindow: true,
  distanceTop: 36,
  distanceLeft: window.screen.availWidth>1600?24:16,
  matchExact: false,
};
const newTabUrl = 'chrome://newtab/';
let canMap = true;
let lastWindowId = null;

chrome.browserAction.onClicked.addListener(function(tab) {
  autoSort()
});
chrome.windows.onFocusChanged.addListener(function(win){
  if(canMap&&lastWindowId!==win&&win!==-1){
    // reMapWindow();
  }
  lastWindowId = win===-1?lastWindowId:win;
});
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
chrome.tabs.onActivated.addListener(function (tab) {
  // console.log('tab change',tab)
  // reMapWindow()
});
chrome.tabs.onDetached.addListener(function(){
  // console.log('detached')
  // canMap = false;
});
chrome.tabs.onAttached.addListener(function () {
  // console.log('onattached')
  // canMap = true
});
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
      chrome.windows.update(targetWindowId, {focused:false},function(){
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

//todo active tab 处理后任然需要激活

/**布局函数，对外暴露*/
const autoSort = function() {
  chrome.tabs.query({active:true,currentWindow:true},function(activeTabs){
    const activeTab = activeTabs[0] || {};
    reMapTabs(activeTab.id);
    chrome.system.display.getInfo(function(screens){
      chrome.windows.getCurrent({}, function(result){
        const currentTop = result.top;
        const currenLeft = result.left;

        const modelWindow = {
          width: window.screen.availWidth,
          height: window.screen.availHeight,
          left: window.screen.availLeft,
          top: window.screen.availTop,
        };

        for(let i=0; i<screens.length; i++) {
          const screen = screens[i].bounds;
          const minTop = screen.top;
          const maxTop = screen.top+screen.height;
          const minLeft = screen.left;
          const maxLeft = screen.left+screen.width;

          if(currentTop>=minTop && currentTop<=maxTop && currenLeft>=minLeft && currenLeft<=maxLeft){
            modelWindow.width = screen.width;
            modelWindow.height = screen.height-70;
            modelWindow.left = screens[i].workArea.left;
            modelWindow.top = screens[i].workArea.top;
            break;
          }
        }

        const models = [];
        for(let i=0; i<setting.maxWindow; i++) {

          models.push({
            width: modelWindow.width,
            height: modelWindow.height,
            top: modelWindow.top + i*setting.distanceTop,
            left: modelWindow.left + i*setting.distanceLeft,
          })
        }

        reMapWindow(activeTab,models);
      })
    });
  })
};

// 整理 tabs
const reMapTabs = function(activeTabId){
  chrome.tabs.query({}, function (tabs) {
    const tabObject = {
      combine:[]
    };
    tabs.forEach((tab)=>{
      let key = getDomain(tab.url) || 'combine';
      key = key.replace('127.0.0.1','localhost');
      if(tabObject[key]){
        tabObject[key].push(tab)
      } else {
        tabObject[key] = [tab]
      }
    });

    /** 根据每个窗口对象的个数倒序排序 10，8，6*/
    const keys = Object.keys(tabObject).sort((key1,key2)=>{
      const length = tabObject[key2].length-tabObject[key1].length;
      // 相同情况下，根据key字母排序
      return length===0?(key2>key1?1:-1):length;
    });
    const maxWindow = setting.maxWindow;
    const maxTab = setting.tabMax;
    if(keys.length>maxWindow){
      let parentIndex = 0;
      for(let i=keys.length-1; i>= maxWindow; i--){
        let moved = false;
        const needMoveTabs = tabObject[keys[i]];
        if(needMoveTabs.length===0){
          continue;
        }
        while(parentIndex<maxWindow && !moved){
          const parentTabs = tabObject[keys[parentIndex]];
          if(parentTabs.length+needMoveTabs.length<maxTab){
            parentTabs.push(...needMoveTabs);
            delete tabObject[keys[i]]
            moved = true;
          }else{
            parentIndex++
          }
        }
      }
    }
    const windowTabs={};
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
          chrome.tabs.move(moveTabs,{windowId:win.id,index:-1},function(){
            chrome.tabs.update(activeTabId,{highlighted:true,active:true,autoDiscardable:true});
          })
        })
      }else {
        chrome.tabs.move(moveTabs,{windowId:targetWindowId,index:-1},function(){
          chrome.tabs.update(activeTabId,{highlighted:true,active:true,autoDiscardable:true});
        })
      }
    }
  });
};

// 布局 windows
const reMapWindow = debounce(function(activeTab,modelWindows) {
  chrome.windows.getAll({populate:true}, function(result){
    chrome.tabs.query({active:true,currentWindow:true}, function(tabs) {
      const tab = activeTab||tabs[0];
      if(!tab) return;
      const currentId = tab.windowId;
      const windows = result.filter((item)=>{
        return item.tabs.length>0
      }).sort(function(window,next){
        return  next.tabs.length-window.tabs.length
      }).sort(function(window){
        return window.id===currentId?1:-1
      });

      if(windows.length===0) return;

      // Object.assign({
      //   width: window.screen.availWidth-(windows.length-1)*setting.distanceLeft,
      //   height: window.screen.availHeight,
      //   left: window.screen.availLeft,
      //   top: window.screen.availTop,
      // },modelWindow);

      mapWindow();
      function mapWindow() {
        canMap = false;
        doMove(0);

        function doMove(index) {
          const firstWindow = modelWindows[index] || modelWindows[0];
          if(index>=windows.length){
            canMap = true;
            chrome.tabs.update(tab.id,{highlighted:true,active:true});
            return;
          };
          const top = firstWindow.top;
          const left = firstWindow.left;
          const width = firstWindow.width; //- (windows.length-index+1)*setting.distanceLeft;
          const height = firstWindow.height;
          move(windows[index],{top,left,width,height},function () {
            chrome.windows.update(windows[index].id,{focused:true},function(){
              doMove(index+1);
            })
          })
        }
      }
      function move(window,targetPosition,callback,index=0) {
        const distance = targetPosition.top-window.top;
        const absDistance = Math.abs(distance);
        if(absDistance<=1&&index>0){
          callback();
          return;
        };

        let step = 1;
        if(absDistance>200){
          step = Math.floor(absDistance/4)+1;
        } else if(absDistance>81){
          step = Math.floor(Math.sqrt(absDistance))+1;
        } else if(absDistance>50) {
          step = Math.floor(absDistance/8)+1;
        }
        else{
          step = Math.floor(absDistance/6)+1
        }
        step = Math.min(10,step);
        // 跨象限时直接移动到位
        if(targetPosition.top*window.top<0){
          step = absDistance;
        }
        const nextTop = window.top+(distance>0?step:-step);
        // 多布局窗口不互相遮挡情况下，同时移动
        chrome.windows.update(window.id, {
          drawAttention:false,
          focused:false,
          top:nextTop,
          left:targetPosition.left,
          width:targetPosition.width,
          height:targetPosition.height
        },function (result) {
              const a = Math.abs(result.top-targetPosition.top);
              if(a<=1||index>1000){
                callback(result)
              }else{
                move(result,targetPosition,callback,index+1);
              }
        })
      }
    })
  });
},200)



/**右击菜单*/
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

/**快捷键*/
chrome.commands.onCommand.addListener(function(command) {
  if(command === 'clear-up-window'){
    autoSort()
  }
});

/**工具方法*/
function getDomain(url){
  const matchresult =  (url.match(/^https?:\/\/.*?\.?([^\/]*)/i)||[])[1]||'';
  const hostArray = matchresult.split('.');
  // 模糊匹配，只取顶级域名
  if(hostArray.length>2 && !setting.matchExact){
    return hostArray.slice(hostArray.length-2).join('.');
  }

  return matchresult;
}

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
