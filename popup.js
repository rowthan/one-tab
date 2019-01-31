function sendMessage(req,cb) {
    chrome.tabs.getSelected(null, function(tab) {
        chrome.tabs.sendMessage(tab.id, req, function(response) {
            typeof cb === 'function' && cb(response)
        });
    });
}




class Frames extends React.Component{

    constructor(props){
        super(props)
        this.state={
            frames:[],
            mainPage:{alpha:1},
            activeFrame:'',
            errorMsg:'最底层展示优先级越高',
        }
        this.setActive = this.setActive.bind(this)
        this.changeAlpha = this.changeAlpha.bind(this)
        this.initPage = this.initPage.bind(this)
    }

    render(){
        return <div>
            {
                this.state.frames.map((frame,index)=>
                    <div key={frame.src+index}>
                        <input type="range" max={100} min={-1} value={frame.alpha*100} onChange={(event)=>this.changeAlpha(index,event.target.value)}/>
                        <label>
                            <input checked={this.state.mainPage.activeIndex === index} onChange={()=>this.setActive(index)} name='activeFrame' type='radio' value={frame.src} />
                            {frame.src}
                        </label>
                        <button  onClick={()=>this.deleteFrame(index)}>删除</button>
                    </div>
                )
            }
            <div>
                <input type="range" max={100} min={-1} value={this.state.mainPage.alpha*100} onChange={(event)=>this.changeAlpha(-1,event.target.value)}/>
                <label>
                    <input checked={this.state.mainPage.activeIndex===-1} onChange={()=>this.setActive(-1)} name='activeFrame' type='radio'/>
                    主页
                </label>
            </div>

            <div>
                {this.state.errorMsg}
            </div>
        </div>
    }

    componentDidMount(){
        this.initPage()
    }

    initPage() {
        const that = this;
        sendMessage({type:'getInfos'},function (result) {
            that.setState({
                frames: result.frames,
                mainPage: result.mainPage
            })
        })
    }

    setActive(index) {
        sendMessage({type:'setActive',activeIndex:index},(result)=>{
            if(result.success){
                this.initPage()
            }
        });
    }
    changeAlpha(index,alpha) {
        sendMessage({type:'setAlpha',frameIndex:index,alpha:alpha/100.00},(result)=> {
            if(result.success){
                this.initPage()
            }
        });
    }
    deleteFrame(index) {
        sendMessage({type:'deleteFrame',frameIndex: index}, (result)=> {
            if(result.success){
                this.initPage();
            }
        })
    }

}

class AddSection extends React.Component{
    constructor(props){
        super(props)
        this.state={
            value:'https://www.',
            errMsg: ''
        }

        this.addFrame = this.addFrame.bind(this);
    }

    render(){
        return (<div>
            <input  value={this.state.value} onChange={(event)=>{this.setState({value:event.target.value})}}  type="text" placeholder="请输入url"/>
            <button id="add-frame" onClick={this.addFrame}>添加</button>
            <div style={{color:'red'}}>
                {this.state.errMsg}
            </div>
            </div>)

    }

    addFrame(){
        sendMessage({type:'addFrame',data:this.state.value}, (resp)=> {
            if(resp.success){
                this.setState({
                    errMsg:'添加成功'
                })
                window.close()
            }else{
                this.setState({
                    errMsg: resp.errMsg || '添加失败'
                })
            }
        })
    }
}



ReactDOM.render(
    <div>
        <Frames/>
        <AddSection/>
    </div>,
    document.getElementById('popup')
);
