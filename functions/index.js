const util = require('./util');
const flex = require('./flex');
const {  initializeApp,  cert } = require('firebase-admin/app');
const {
    getFirestore
} = require('firebase-admin/firestore');
const functions = require("firebase-functions");
const serviceAccount = require('./config.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const userDb = db.collection("user")

exports.Webhook = functions.region("asia-northeast1").https.onRequest(async (req, res) => {
    if (req.method === "POST") {

        if (!util.verifySignature(req.headers["x-line-signature"], req.body)) {
            return res.status(401).send("Unauthorized");
        }
        const events = req.body.events
        for (const event of events) {
            if (event === undefined) {
                return res.end();
            }


            //  Start Join with LINE Group 
            if (event.type === "join") {
                if (event.source.type === "group") {
                    await util.reply(event.replyToken, [flex.welcomeMessage()]);
                }
            }

            
            if (event.type === "message") {


                if (event.source.type === "group") {
                    // insert and update member by groupId
                    insertUserGroup(event.source.userId, event.source.groupId)
                }


                if (event.message.type === "text") {

                    let textMessage = event.message.text

                    if (textMessage === "สวัสดี") {
                        await util.reply(event.replyToken, [flex.welcomeMessage()]);
                    }

                    if (textMessage === "ตี้ฉัน") {
                        let countGroup = await countUserGroup(event.source.groupId)
                        await util.reply(event.replyToken, [{
                            type: "text",
                            text: "ตอนนี้ ตี้ของคุณมี " + countGroup + " คน แบ่งกันให้ถูกนะ!"
                        }]);
                    }


                    if (textMessage === "แตกตี้") {
                        await util.reply(event.replyToken, [{
                            type: "text",
                            text: "ให้พิมพ์คำแรกว่า แตก ตามด้วย {{จำนวนคน ตามจำนวนโต๊ะ}} เช่น\n\nแตก 4 4\n==> หมายถึง มี 2 โต๊ะ โต๊ะละ 4 คน\nแตก 2 4 4\n==> หมายถึง มี 3 โต๊ะ\n       โต๊ะที่ 1 จำนวน 2 คน\n       โต๊ะที่ 2 จำนวน 4 คน\n       โต๊ะที่ 3 จำนวน 4 คน\n\nข้อจำกัด\n1.ต้องไม่เกินจำวนคนในโต๊ะ \n2. โต๊ะต้องไม่ต่ำกว่า 2 คน และไม่เกิน 10-20 คน\n3.แบ่งโต๊ะได้ไม่เกิน 10 โต๊ะ"
                        }]);
                    }

                    // ----------------------- main service 
                    let splitStringMessage = textMessage.split(' ')
                    let subStringMessage = splitStringMessage[0].substring(0, 4)
                    if (subStringMessage === "แตก") {
                        let countGroup = await countUserGroup(event.source.groupId)
                        if (splitStringMessage.length > 2 && countGroup >= 2) {

                            let arrLoopTable = []
                            let sumNumMember = 0
                            splitStringMessage.forEach(async elm => {

                                // Check is not แตก
                                if (subStringMessage != elm) {

                                    // Convert Type
                                    // CHeck case แตก 2d 1df x
                                    let countNumber = Number(elm.substring(0, 1))

                                    if (countNumber !== 0) {

                                        // Check Type Number and Validate Nan
                                        if (typeof countNumber === 'number' && countNumber === countNumber) {
                                            sumNumMember += parseInt(countNumber);
                                            arrLoopTable.push(countNumber)
                                        } else {
                                            await util.reply(event.replyToken, [{
                                                type: "text",
                                                text: "Format แตกไม่ถูกต้อง กรุณาพิมพ์ แตก เว้นวรรค {ตัวเลขจำนวนคน} ในแต่ละโต๊ะ\nให้พิมพ์คำแรกว่า แตก ตามด้วย {{จำนวนคน ตามจำนวนโต๊ะ}} เช่น\n\nแตก 4 4\n==> หมายถึง มี 2 โต๊ะ โต๊ะละ 4 คน\nแตก 2 4 4\n==> หมายถึง มี 3 โต๊ะ\n       โต๊ะที่ 1 จำนวน 2 คน\n       โต๊ะที่ 2 จำนวน 4 คน\n       โต๊ะที่ 3 จำนวน 4 คน\n\nข้อจำกัด\n1.ต้องไม่เกินจำวนคนในโต๊ะ \n2.โต๊ะต้องไม่ต่ำกว่า 2 คน และไม่เกิน 10 คน\n3.แบ่งโต๊ะได้ไม่เกิน 10 โต๊ะ"
                                            }]);
                                        }
                                    } else {
                                        await util.reply(event.replyToken, [{
                                            type: "text",
                                            text: "ห้ามพิมพ์ 0 นะ เอาดีๆ เดี๋ยวหน้า แตกหรอก"
                                        }]);
                                    }


                                }

                            });

                            console.log("countGroup :", countGroup, " === ", " sumNumMember :", sumNumMember);
                            if (countGroup === sumNumMember) {
                                let arrUer = await getUserGroup(event.source.groupId)
                                if (arrUer !== 0) {
                                    await replyTableInGroup(event.replyToken, arrUer, arrLoopTable)
                                }
                            } else {
                                await util.reply(event.replyToken, [{
                                    type: "text",
                                    text: "จำนวนสมาชิกในโต๊ะไม่ถูกต้อง \ สมาชิกในโต๊ะปัจจุบัน : " + countGroup + "  แต่ผลรวมท่านได้ : " + sumNumMember + " \n\n กลับไปกรอกใหม่ให้ถูกต้อง!"
                                }]);
                            }


                        } else {
                            await util.reply(event.replyToken, [{
                                type: "text",
                                text: "โปรดระบุจำนวนโต๊ะ มากกว่า 2 โต๊ะ ให้เท่ากับจำนวนคน \n ปัจจุบัน:" + countGroup + " คน"
                            }]);
                        }
                    }
                    // -----------------------
                }

            }

            // remove group
            if (event.type === "leave") {
                if (event.source.type === "group") {
                    await deleteGroup(event.source.groupId)
                }
            }

            // create member group
            if (event.type === "memberJoined") {
                if (event.source.type === "group") {
                    for (const member of event.joined.members) {
                        if (member.type === "user") {
                            let profile = await insertUserGroup(member.userId, event.source.groupId)
                            let countGroup = await countUserGroup(event.source.groupId)
                            await util.reply(event.replyToken, [flex.quickReplyWelcomeMessage(profile.data.displayName, countGroup)]);
                        }
                    }

                }
            }

            // remove member group
            if (event.type === "memberLeft") {
                if (event.source.type === "group") {
                    for (const member of event.left.members) {
                        if (member.type === "user") {
                            await deleteUserGroup(member.userId, event.source.groupId)
                        }
                    }

                }
            }
        }

    }
    return res.send(req.method);
});


// Insert Member by userId and groupId
const insertUserGroup = async (userId, groupId) => {

    const profile = await util.getProfileGroup(groupId, userId)

    let userDocument = userDb.where("groupId", "==", groupId).where("userId", "==", userId)
    let userCount = await userDocument.count().get()
    if (userCount.data().count === 0) {
        await userDb.add({
            userId: profile.data.userId,
            displayName: profile.data.displayName,
            pictureUrl: profile.data.pictureUrl,
            groupId: groupId,
            createAt: Date.now()
        })

    }
    return profile

}

// delete Member by userId and  groupId
const deleteUserGroup = async (userId, groupId) => {

    let userDocument = userDb.where("groupId", "==", groupId).where("userId", "==", userId)
    await userDocument.get().then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
            doc.ref.delete();
        });
    });

}

// delete Group by groupId
const deleteGroup = async (groupId) => {

    let userDocument = userDb.where("groupId", "==", groupId)
    await userDocument.get().then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
            doc.ref.delete();
        });
    });

}

// count user by groupId
const countUserGroup = async (groupId) => {
    let userDocument = userDb.where("groupId", "==", groupId)
    let userCount = await userDocument.count().get()
    return userCount.data().count
}

// Get User Lists by groupId
const getUserGroup = async (groupId) => {

    const userDocument = await userDb.where("groupId", "==", groupId).get()
    let userCount = await userDb.where("groupId", "==", groupId).count().get()
    if (userCount.data().count > 1) {
        var arrayUser = []
        userDocument.forEach((doc) => {
            arrayUser.push(doc.data())
        });
    }
    return (arrayUser.length > 1) ? arrayUser : 0
}

// Reply Message and Random User and Table
const replyTableInGroup = async (replyToken, arrayUser, arrLoopTable) => {



    // randomize (shuffle)
    let randomUser = arrayUser.sort(function () {
        return 0.5 - Math.random()
    })
    //----------------------


    // set table
    // recommend 10-20 table 
    const countTable = 10

    // array user per table <= table
    // exm.
    // แตก 1 1 1 1 1 1 1 1 1 1 => 10 = true
    // แตก 1 1 1 1 1 1 1 1 1 1 2 => 11 = false
    if (arrLoopTable.length <= countTable) {


        // create array table
        let arrTable = Array(countTable).fill({members: []})
        //-------------


        // set up member on table 
        tableIndex = 0
        randomUser.forEach((value) => {
            arrTable[tableIndex].members.push(value)
            if (arrTable[tableIndex].members.length >= arrLoopTable[tableIndex]) tableIndex++
        });
        //-------------


        // message report member
        let nameList = ''
        let groupNo = 1
        arrTable.forEach((elmTable) => {

            if (elmTable.members.length > 0 && elmTable.members.length <= 10) {
                nameList += 'โต๊ะ ' + groupNo + " จำนวน " + elmTable.members.length + " คน"
                let memberNo = 1
                elmTable.members.forEach((memberList) => {
                    nameList += " \n " + memberNo + "." + memberList.displayName
                    memberNo++
                });
                nameList += "\n ------------------\n "
                groupNo++

            }

        });
        nameList += " แตกโต๊ะ แต่ไม่แตกแยก กลับมาแตกด้วยกันใหม่น้า "
        await util.reply(replyToken, [{
            type: "text",
            text: nameList
        }]);
        //-------------
    }

}