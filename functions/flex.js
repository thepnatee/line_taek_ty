const welcomeMessage = () => (
  {
  "type": "text",
  "text": "สวัสดี ทุกคน ก่อนจะให้น้องช่วยแตก ... รบกวนให้ทุกคนพิมพ์ ทักทาย เพื่อให้น้องรู้จักก่อนน้า ",
  "quickReply": {
    "items": [{
      "type": "action",
      "imageUrl": "https://cloud.ex10.tech/public/filestore/Role-0ffccdc7-6e08-11ed-ad02-e6a905c1c90f.jpg",
      "action": {
        "type": "message",
        "label": "แตกตี้",
        "text": "แตกตี้"
      }
    },{
      "type": "action",
      "imageUrl": "https://cloud.ex10.tech/public/filestore/Role-0ffccdc7-6e08-11ed-ad02-e6a905c1c90f.jpg",
      "action": {
        "type": "message",
        "label": "ตี้ฉัน",
        "text": "ตี้ฉัน"
      }
    }]
  }
})
const quickReplyWelcomeMessage = (displayName,countGroup) => (
  {
  "type": "text",
  "text": "สวัสดี " + displayName + " มาเริ่มแตก...ตี้! คลิกปุ่มแตกตี้  ตอนนี้กลุ่มของท่านมี " + countGroup + " คนแล้ว",
  "quickReply": {
    "items": [{
      "type": "action",
      "imageUrl": "https://cloud.ex10.tech/public/filestore/Role-0ffccdc7-6e08-11ed-ad02-e6a905c1c90f.jpg",
      "action": {
        "type": "message",
        "label": "แตกตี้",
        "text": "แตกตี้"
      }
    },{
      "type": "action",
      "imageUrl": "https://cloud.ex10.tech/public/filestore/Role-0ffccdc7-6e08-11ed-ad02-e6a905c1c90f.jpg",
      "action": {
        "type": "message",
        "label": "ตี้ฉัน",
        "text": "ตี้ฉัน"
      }
    }]
  }
})
module.exports = {
  welcomeMessage,
  quickReplyWelcomeMessage
};