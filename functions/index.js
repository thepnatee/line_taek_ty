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

/* https://asia-northeast1-line-taek-ty.cloudfunctions.net/Webhook */
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
        /*🔥 1. Join to Chat Group 🔥
        https://developers.line.biz/en/reference/messaging-api/#join-event
        */
        if (event.type === "join") {
            /* ✅ 1.1 [join] reply util.reply(event.replyToken,[messages.welcomeMessage()]) */
            // await util.reply(event.replyToken, [messages.welcomeMessage()])
                await util.reply(event.replyToken, [messages.welcomeMessage()])
            return;
        }


        /* 🔥 2. Member Joined to Chat Group 🔥
        https://developers.line.biz/en/reference/messaging-api/#member-joined-event
        }*/
        if (event.type === "memberJoined") {
            for (let member of event.joined.members) {
                if (member.type === "user") {
                    /* ✅ 2.1 [profile] Insert and Update By Group ID to Database  */
                    /* call function insertUserGroup(member.userId, event.source.groupId) */
                    let profile = await insertUserGroup(member.userId, event.source.groupId)

                    /* ✅ 2.2 [countGroup] Total Member Group From Database */
                    /* call function countUserGroup(event.source.groupId); */
                    let countGroup = await countUserGroup(event.source.groupId)

                    /* ✅ 2.3 [memberJoined] reply [memberJoinedMessage(profile.data.displayName,countGroup)] */
                    await util.reply(event.replyToken, [messages.memberJoinedMessage(profile.data.displayName, countGroup)])
                }
            }
            return;
        }


        /* 🔥 3. Event Message 🔥
        https://developers.line.biz/en/reference/messaging-api/#message-event
         */
        if (event.type === "message" && event.message.type === "text") {

            /* ✅ 3.1 call function : insertUserGroup(event.source.userId, event.source.groupId)  */
            await insertUserGroup(event.source.userId, event.source.groupId)

            let textMessage = event.message.text


            /* 🚨 Check Total Member Group From Database */
            if (textMessage === "ตี้ฉัน") {

                /* ✅ 3.2 Count  Group : countUserGroup(event.source.groupId) */
                let countGroup = await countUserGroup(event.source.groupId)

                /* ✅ 3.3 [summaryGroup] reply message : summaryGroup(countGroup) */
                await util.reply(event.replyToken, [messages.summaryGroup(countGroup)])

                return;
            }


            /* 🚀 main feature  */
            let splitStringMessage = textMessage.split(' ')
            let subStringMessage = splitStringMessage[0].substring(0, 4)
            if (subStringMessage === "แตก") {

                /* ✅ 3.4 call function :  countUserGroup(event.source.groupId) */
                let countGroup = await countUserGroup(event.source.groupId)

                /* 🔎 Validate Element Array from 
                    subStringMessage = แตก
                    splitStringMessage  = [แตก, 4,4,4,5] 
                */
                const arrayTable = await validateSplitStringMessage(splitStringMessage, subStringMessage)

                /* 🔎 Summary Array */
                const sumNumMember = arrayTable.reduce((acc, val) => acc + val, 0);

                /* ❌ [Reply Error Message] Table < 2 */
                if (arrayTable.length < 2) {
                    await util.reply(event.replyToken, [messages.countTableError(countGroup)]);
                    return;
                }

                /* ❌[reoply ฎrror message] Summary group from array not equl all member in group  */
                if (countGroup !== sumNumMember) {
                    await util.reply(event.replyToken, [messages.summaryGroupError(countGroup, sumNumMember)]);
                    return;
                }

                /* ✅ 3.5 [shuffleTableGroup]call function :  shuffleTableGroup(event.replyToken,event.source.groupId, arrayTable) */
                await shuffleTableGroup(event.replyToken, event.source.groupId, arrayTable);
                return;

            }

        }


        /* 🔥 4. Member Leave From Chat Group 🔥
        https://developers.line.biz/en/reference/messaging-api/#member-left-event
        */
        if (event.type === "memberLeft") {
            for (const member of event.left.members) {
                if (member.type === "user") {
                    /* ✅ 4.1 [deleteUserGroup] call function deleteUserGroup(member.userId, event.source.groupId) */
                    await deleteUserGroup(member.userId, event.source.groupId)

                }
            }
            return;
        }


        /* 🔥 5. Leave From Chat Group 🔥
        https://developers.line.biz/en/reference/messaging-api/#leave-event
        */
        if (event.type === "leave") {
            /* 5.1 ✅ [deleteGroup] call function deleteGroup(event.source.groupId);  */
            await deleteGroup(event.source.groupId)
            return;
        }


    }

    return res.send(req.method);
});



/* Insert Member by userId and groupId */
const validateSplitStringMessage = async (splitStringMessage, subStringMessage) => {

    return splitStringMessage
        .filter(element => subStringMessage !== element)
        .map(element => {
            const countNumber = Number(element.substring(0, 2));
            if (!isNaN(element) && countNumber !== 0) {
                return countNumber;
            } else {
                throw new Error('❌ Invalid number format');
            }
        });
}

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
const shuffleTableGroup = async (replyToken, groupId, arrayTable) => {

    let arrayUser = await getUserGroup(groupId)
    /* 
       randomize (shuffle) : shuffleArray(arrayUser) 
       Array User List From Database
    */
    let shuffleUser = await shuffleArray(arrayUser)

    /* const countTable : Maximum Table Available */
    const countTable = 20
    /* 
    Create Table : crateTable(arrayTable.length)
    */
    let arrTable = await createTable(countTable, arrayTable.length)



    /* Push Member to Table */
    let tableIndex = 0
    /* table[][][][] & members = 🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️ => table [🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️][🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️][🧍🏻‍♂️🧍🏻‍♂️][🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️🧍🏻‍♂️] */
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
const createTable = async (countTable, arrayTableLength) => {
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