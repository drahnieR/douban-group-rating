// ==UserScript==
// @name         Douban Group Rating
// @version      0.1
// @description  Get the rating from specific following group
// @author       Reinhard
// @include      /^https?://(music|book|movie)\.douban\.com/subject/\d+/(\?.*)?$/
// @include      /^https?://www\.douban\.com/(people/[^/]+|mine)/$/
// @require      https://code.jquery.com/jquery-3.4.1.min.js
// @require      https://cdn.jsdelivr.net/npm/js-cookie@beta/dist/js.cookie.min.js
// @grant        none
// @connect      douban.com
// @license      MIT
// @run-at       document-end
// ==/UserScript==

'use strict';

this.$ = this.jQuery = jQuery.noConflict(true);

CATEGORIES = ['movie', 'music', 'book'];

async function getFriendsRating(start = 0) {
  const url = `https://${answerObj.TYPE}.douban.com/subject/${answerObj.SUBJECT_ID}/collections?start=${start}&show_followings=on`

  const data = await $.get(url)
  return $(data).find('.sub_ins > table').get()
    .map(tab => {
      tab = $(tab);

      return {
        id: tab.find('td > a > img')[0].src.match(/icon\/(u\d+)-\d*\./)[1],
            // "https://img3.doubanio.com/icon/u67426011-193.jpg"
        // url: tab.find('td:last-child > div > a')[0].href,
        rating: Number(tab.find('td:last-child > div + p > span:last-child')[0].className.slice(7, 8))
            // class: "allstar50"
      }
    })
}

async function getFriendsPage(start = 0) {
  const url = `https://www.douban.com/contacts/list?tag=0&start=${start}`

  const data = await $.get(url)
  return $(data).find('ul.user-list > li').get()
    .map(li => {
      li = $(li);
      const group = li.find('ul.set-group-list > li > input:checkbox:checked')

      return {
        id: li.prop('id'),
        // url: li.find('h3 > a')[0].href,
        groups: li.find('ul.set-group-list > li > input:checkbox:checked + label').get()
                  .map(s => s.textContent)
                  // .map(s => { return {id: s.htmlFor, name: s.textContent} })
      }
    })
}

async function getFriendsGroup() {
  const mine = await $.get('https://www.douban.com/mine')
  const numFollowings = $(mine).find("#friend :contains('我的关注') a[href]:contains('成员')").text().replace(/[^0-9]/g,"");
  const pagesFollowings = Math.ceil(numFollowings/20);

  const followers = []

  for (let i = 0; i < pagesFollowings; i ++) {
    const pageResult = await getFriendsPage(i * 20)
    followers.push(... pageResult)
  }

  const groups = {}

  followers.forEach(ppl => {
    ppl.groups.forEach(group => {
      if (!CATEGORIES.includes(group)) return;

      if (groups[group]) {
        groups[group].push(ppl.id)
      }
      else {
        groups[group] = [ ppl.id ]
      }
    })
  })

  for (const g of CATEGORIES) {
    if (groups[g])
      Cookies.set(`douban-group-rating_${g}`, groups[g].join('.'), { expires: 90, path: '/', domain: '.douban.com' })
  }
  Cookies.set('douban-group-rating_ts', +new Date(), { expires: 90, path: '/', domain: '.douban.com' })
}


(async () => {

  if (/^https?:\/\/(music|book|movie)\.douban\.com\/subject\/\d+\/(\?.*)?$/.test(window.location.href)) {
    let finished = false;
    let count = 0;
    const REQUEST_CAPACITY = 10;

    let resultArray = [];

    do {
      const results = await getFriendsRating(count * 100)
      resultArray = resultArray.concat(results)
      count ++;
      finished = results.length == 0 || count > REQUEST_CAPACITY
    } while (!finished)

    const group = Cookies.get(`douban-group-rating_${answerObj.TYPE}`).split('.')
    resultArray = resultArray.filter(r => group.includes(r.id))

    const average = resultArray.reduce((sum, curr) => sum + curr.rating * 2, 0) / resultArray.length;
    const score = Math.round((average - 2) * 10 / 8 * 100) / 100

    $('.friends_rating_wrap').append(`<div class='rating_content_wrap clearfix'>分组评分 ${score}</div>`)
  }
  else if (/^https?:\/\/www\.douban\.com\/(people\/[^\/]+|mine)\/$/.test(window.location.href)) {
    $("#friend+p").append("<br/><a id='getFriendsGroup' href='javascript:void(0)'>> 获取分组</a><br/>");
    const link = $("#getFriendsGroup");
    link.click(() => {
      getFriendsGroup()
        .catch(e => console.log(e))
    })
  }

})().catch(err => {
  console.log("Douban Group Rating", err)
});
