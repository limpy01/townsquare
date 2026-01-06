<template>
  <div
    id="app"
    :style="{
      backgroundImage: `url('assets/background.png')`
    }"
  >
    <span><b>本项目是完全免费的，如果你愿意支持一下可以通过以下方法：</b></span>
    <div id="qr">
      <div id="qq">
        <img src="https://botcgrimoire.top/dynamic/qqpay.jpeg" alt="QQ pay" style="height: 400px;">
      </div>
      <div id="alipay">
        <img src="https://botcgrimoire.top/dynamic/alipay.jpeg" alt="Ali pay" style="height: 400px;">
      </div>
      <div id="alipay">
        <img src="https://botcgrimoire.top/dynamic/wechatpay.jpeg" alt="WeChat pay" style="height: 400px;">
      </div>
    </div>
    <div id="paypal">
      <span><b>海外用户也可以使用Paypal</b></span>
      <br/>
      <form action="https://www.paypal.com/donate" method="post" target="_top">
        <input type="hidden" name="hosted_button_id" value="LYSK4TSZ9TAC6" />
        <input type="image" src="https://www.paypalobjects.com/zh_XC/i/btn/btn_donateCC_LG.gif" border="0" name="submit" title="PayPal - The safer, easier way to pay online!" alt="使用PayPal按钮进行捐赠" />
        <img alt="" border="0" src="https://www.paypal.com/zh_C2/i/scr/pixel.gif" width="1" height="1" />
      </form>
    </div>
    <!-- <div id="ads">
      <span><b>囊中羞涩？</b></span>
      <br/>
      <a href="https://botcgrimoire.top/ads" target="_blank">也可以点击看看广告来支持网站！</a>
      <br/>
      <span><b>（点击和观看都会有帮助！请勿轻信广告！）</b></span>
    </div> -->
  </div>
</template>

<script>
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow-x: auto;
}

body {
  font-size: 1.2em;
  line-height: 1.4;
  background: url("assets/background.png") center center;
  background-size: cover;
  height: 100%;
  font-family: "Roboto Condensed", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  padding: 0;
  margin: 0;
}

#app {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.5); /*Semi-transparent white for readability*/
  padding: 20px; /* Add some padding around your content */
  min-height: 100vh; /* Ensure the content area also covers at least the viewport height */
  box-sizing: border-box; /* Include padding in element's total width and height */
}

#qr {
  display: flex; /* Activates Flexbox */
  justify-content: center; /* Centers the images horizontally within the container */
  gap: 40px; /* Optional: Adds space between the two images */
  margin: 20px 0; /* Optional: Adds space above and below the payment methods section */
  flex-direction: column; 
  align-items: center; /* Center items when stacked vertically */
}
@media (min-width: 768px) {
  #qr {
      flex-direction: row; /* Override: Show side-by-side on larger screens */
      align-items: flex-start;
  }
}

#paypal {
  text-align: center;
}

#ads {
  text-align: center;
}

::-webkit-scrollbar {
  width: 10px;
}
::-webkit-scrollbar-thumb {
  background: rgb(54, 54, 54); 
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgb(97, 97, 97); 
}
::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.5); /* This makes the scrollbar background semi-transparent white */
  border-radius: 10px; /* Optional: adds rounded corners to the track */
}
</style>