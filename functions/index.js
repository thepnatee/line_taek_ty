const util = require('./util');
const messages = require('./message');
const {
    initializeApp,
    cert
} = require('firebase-admin/app');
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


// Function Webhook
exports.Webhook = functions.region("asia-northeast1").https.onRequest(async (req, res) => {

    if (req.method !== "POST") {
        return res.send(req.method);
    }

    if (!util.verifySignature(req.headers["x-line-signature"], req.body)) {
        return res.status(401).send("Unauthorized");
    }

    const events = req.body.events
    for (const event of events) {
        if (event.source.type !== "group") {
            return;
        }


        /* 1. Join to Chat Group
        https://developers.line.biz/en/reference/messaging-api/#join-event
        {
            "replyToken": "nHuyWiB7yP5Zw52FIkcQobQuGDXCTA",
            "type": "join",
            "mode": "active",
            "timestamp": 1462629479859,
            "source": {
              "type": "group",
              "groupId": "C4af4980629..."
            },
            "webhookEventId": "01FZ74A0TDDPYRVKNK77XKC3ZR",
            "deliveryContext": {
              "isRedelivery": false
            }
          }*/
        if (event.type === "join") {
            /* 1.1 reply util.reply(event.replyToken,messages.welcomeMessage()) */
            util.reply(event.replyToken, [messages.welcomeMessage()])
            
            return;
        }

        /* 2. Member Joined to Chat Group
        https://developers.line.biz/en/reference/messaging-api/#member-joined-event
        "joined": {
            "members": [
              {
                "type": "user",
                "userId": "U4af4980629..."
              },
              {
                "type": "user",
                "userId": "U91eeaf62d9..."
              }
            ]
          }*/
        if (event.type === "memberJoined") {
            for (const member of event.joined.members) {
                if (member.type === "user") {

                    /* 2.1 Insert Member & Group ID to DB  */
                    /* call function insertUserGroup(member.userId, event.source.groupId) */

                    let profile = await insertUserGroup(member.userId, event.source.groupId)

                    /* 2.2 Count All Member From Gruop */
                    /* call function countUserGroup(event.source.groupId);*/

                    let countGroup = await countUserGroup(event.source.groupId)

                    /* 2.3 reply memberJoinedMessage(profile.data.displayName,countGroup) */

                    await util.reply(event.replyToken, [messages.memberJoinedMessage(profile.data.displayName, countGroup)])
                }
            }
            return;
        }

        /* 3. Member Leave From Chat Group
        https://developers.line.biz/en/reference/messaging-api/#member-left-event
        "left": {
            "members": [
              {
                "type": "user",
                "userId": "U4af4980629..."
              },
              {
                "type": "user",
                "userId": "U91eeaf62d9..."
              }
            ]
          }*/
        if (event.type === "memberLeft") {
            for (const member of event.left.members) {
                if (member.type === "user") {
                    /*  3.1 call function deleteUserGroup(member.userId, event.source.groupId) */

                    await deleteUserGroup(member.userId, event.source.groupId)
                }
            }
            return;
        }

        /* 4. Event Message */
        if (event.type === "message" && event.message.type === "text") {

            /* 4.1 call function : insertUserGroup(event.source.userId, event.source.groupId)  */
            await insertUserGroup(event.source.userId, event.source.groupId)



            let textMessage = event.message.text

            if (textMessage === "ตี้ฉัน") {
                /* 4.2 Count  Group : countUserGroup(event.source.groupId) */
                let countGroup = await countUserGroup(event.source.groupId)


                /* 4.3 reply message : summaryGroup(countGroup) */
                await util.reply(event.replyToken, [messages.summaryGroup(countGroup)])


                return;
            }


            let splitStringMessage = textMessage.split(' ')
            let subStringMessage = splitStringMessage[0].substring(0, 4)

            if (subStringMessage === "แตก") {

                /* 4.3 call function :  countUserGroup(event.source.groupId) */
                let countGroup = await countUserGroup(event.source.groupId)



                if (splitStringMessage.length > 2 && countGroup >= 2) {


                    /* Convert Element to Number and Validate Format  */
                    const arrayTable = splitStringMessage
                        .filter(element => subStringMessage !== element)
                        .map(element => {
                            const countNumber = Number(element.substring(0, 2));
                            if (countNumber !== 0 && typeof countNumber === 'number') {
                                return countNumber;
                            } else {
                                throw new Error('Invalid number format');
                            }
                        });


                    /* Summary Array  */
                    const sumNumMember = arrayTable.reduce((acc, val) => acc + val, 0);


                    if (countGroup === sumNumMember) {
                        /* 4.5.1 get user list : call functions getUserGroup(event.source.groupId) */
                        let arrUer = await getUserGroup(event.source.groupId)

                        /* 4.5.1 check arra user list > 0  */
                        if (arrUer) {

                            /* 4.5.2 passing value to shuffle function : replyTableInGroup(event.replyToken, arrUer, arrayTable) */
                            await replyTableInGroup(event.replyToken, arrUer, arrayTable)
                            return;
                        }
                    } else {

                        /* [reoply error message] summary group from array not equl all member in group  */
                        await util.reply(event.replyToken, [messages.summaryGroupError(countGroup, sumNumMember)]);
                        return;
                    }


                } else {
                    /* [reoply error message] check table less 2  */
                    await util.reply(event.replyToken, [messages.countTableError(countGroup)]);
                    return;
                }
            }

        }


        /* 5. Leave From Chat Group
        https://developers.line.biz/en/reference/messaging-api/#leave-event
        {
            "type": "leave",
            "mode": "active",
            "timestamp": 1462629479859,
            "source": {
              "type": "group",
              "groupId": "C4af4980629..."
            },
            "webhookEventId": "01FZ74A0TDDPYRVKNK77XKC3ZR",
            "deliveryContext": {
              "isRedelivery": false
            }
          }  */
        if (event.type === "leave") {
            /* 5.1 call function deleteGroup(event.source.groupId);  */
            await deleteGroup(event.source.groupId)

            return;
        }


    }

    return res.send(req.method);
});



/* Insert Member by userId and groupId */
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

/*  delete Member by userId and  groupId */
const deleteUserGroup = async (userId, groupId) => {

    let userDocument = userDb.where("groupId", "==", groupId).where("userId", "==", userId)
    await userDocument.get().then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
            doc.ref.delete();
        });
    });

}

/*  delete Group by groupId */
const deleteGroup = async (groupId) => {

    let userDocument = userDb.where("groupId", "==", groupId)
    await userDocument.get().then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
            doc.ref.delete();
        });
    });

}

/*  count user by groupId */
const countUserGroup = async (groupId) => {
    let userDocument = userDb.where("groupId", "==", groupId)
    let userCount = await userDocument.count().get()
    return userCount.data().count
}

/*  Get User Lists by groupId */
const getUserGroup = async (groupId) => {
    let arrayUser = []
    const userDocument = await userDb.where("groupId", "==", groupId).get()
    let userCount = await userDb.where("groupId", "==", groupId).count().get()
    if (userCount.data().count > 1) {
        userDocument.forEach((doc) => {
            arrayUser.push(doc.data())
        });
    }
    return (arrayUser.length > 1) ? arrayUser : false
}

/*  Reply Message and Random User and Table */
const replyTableInGroup = async (replyToken, arrayUser, arrayTable) => {


    console.log("arrayUser ", arrayUser);

    /* randomize (shuffle) : shuffleArray(arrayUser) */
    let shuffleUser = await shuffleArray(arrayUser)


    console.log("shuffleUser ", shuffleUser);

    /* Create Maximum Table : crateTable(arrayTable.length)  */
    let arrTable = await createTable(arrayTable.length)



    /* Push Member to Table */
    let tableIndex = 0
    shuffleUser.forEach((value) => {
        arrTable[tableIndex].members.push(value)
        if (arrTable[tableIndex].members.length === parseInt(arrayTable[tableIndex])) tableIndex++
    });

    /* message report member */
    let nameList = ''
    let groupNo = 1
    arrTable.forEach((elmTable) => {
        if (elmTable.members.length > 0 && elmTable.members.length <= 100) {
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

    await util.reply(replyToken, [messages.finalNamelist(nameList)]);


}

/*  Shuffle Array By Chat GPT */
const shuffleArray = async (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/* Create Maximum Table */
const createTable = async (arrayTableLength) => {
    /* setup max table */
    const countTable = 20

    if (arrayTableLength > countTable) {
        return;
    }
    let arrTable = []
    for (let index = 0; index <= countTable; index++) {

        arrTable[index] = {
            members: []
        }
    }
    return arrTable;
}