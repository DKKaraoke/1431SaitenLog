const fs = require("fs");

// ログを解析してMapに登録する関数
function parseLogs(logData) {
  // ログを行ごとに分割

  let logMap = new Map();
  const logLines = logData.split("\n");

  // 一時的に保存する変数
  let currentKey = null;
  let songName = null;
  let singerName = null;

  for (const line of logLines) {
    // "Try Reserve"行でキーを取得
    const keyMatch = line.match(/Try Reserve (\d{4}-\d{2})/);
    if (keyMatch) {
      currentKey = keyMatch[1]; // 6619-30の部分
      // 初期化
      songName = null;
      singerName = null;
    }

    // SongName行を解析
    const songMatch = line.match(/SongName = (.+)/);
    if (songMatch) {
      songName = songMatch[1].split("rqif.cpp")[0].trim();
    }

    // SingerName行を解析
    const singerMatch = line.match(/SingerName = (.+)/);
    if (singerMatch) {
      singerName = singerMatch[1].split("rqif.cpp")[0].trim();
    }

    // 必要な情報が揃ったらMapに登録
    if (currentKey && songName && singerName) {
      logMap.set(currentKey, { SongName: songName, SingerName: singerName });
      currentKey = null; // 次のキーに備えて初期化
    }
  }

  return logMap;
}

function parseSongSessions(logData) {
  const logLines = logData.split("\n");

  const sessions = []; // 曲ごとのセッション情報を保存
  let currentSession = null; // 現在解析中のセッション
  let appendix = []; // OnOpen より前のログを一時的に保持

  for (const line of logLines) {
    // 曲の開始を検出
    const startMatch = line.match(/YSAI saitenApiOpen()/);
    // YSAI saitenApiOpen()..OK(0)を含まない

    let ignore = false;
    if (line.indexOf("YSAI saitenApiOpen()..OK(0)") > -1) {
      ignore = true;
    }

    if (startMatch && !ignore) {
      // 既存のセッションがある場合は保存
      if (currentSession) {
        currentSession.appendix = appendix; // 追加のログを含める
        appendix = []; // 次のセッションに備えてリセット
        sessions.push(currentSession);
      }

      // 新しいセッションを作成
      currentSession = {
        start: line, // 開始ログ全体
        logs: [], // 間に発生したログを収集
        appendix: [], // 初期化（このセッションでのAppendixはまだ無い）
      };
      continue; // 他の条件をスキップ
    }

    // 曲の終了を検出
    const endMatch = line.match(/YSAI saitenApiClose()...OK (0)/);
    if (endMatch) {
      if (currentSession) {
        currentSession.end = line; // 終了ログ全体を保存
        currentSession.appendix = appendix; // 追加のログを含める
        appendix = []; // 次に備えてリセット
        sessions.push(currentSession); // 完成したセッションを保存
        currentSession = null; // 初期化して次のセッションに備える
      }
      continue; // 他の条件をスキップ
    }

    // OnOpen前のログをAppendixに保存
    if (!currentSession) {
      appendix.push(line);
    } else {
      // 曲の間のログを収集
      currentSession.logs.push(line);
    }
  }

  // 最後に終了しなかったセッションを処理
  if (currentSession) {
    currentSession.appendix = appendix;
    sessions.push(currentSession);
  }

  return sessions;
}

// コマンドライン引数の取得
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("エラー: ファイルパスを引数として指定してください。");
  process.exit(1);
}

const filePath = args[0];

// ファイルの読み込み
fs.readFile(filePath, "utf8", (err, data) => {
  if (err) {
    console.error(`エラー: ファイルを読み込めませんでした (${filePath})`);
    console.error(err.message);
    process.exit(1);
  }
  const songs = parseLogs(data);
  const songSessions = parseSongSessions(data);

  songSessions.forEach((session, index) => {
    let finished = false;

    const returnObj = {};

    let baseResult = {};
    let noteBonusResult = {};
    let vibBonusResult = {};
    let expBonusResult = {};
    let commonData = {};

    for (const log of session.logs) {
      const match = log.match(/songnum\s*:\s*(\d{4}-\d{2})/);

      if (match) {
        returnObj.songId = match[1];
      }

      if (log.indexOf("YSAI -----SAI : SPR Saiten -----") > -1) {
        finished = true;
        continue;
      }

      if (!finished) {
        continue;
      }

      const matchTotal0 = log.indexOf("YSAI >[0]Total       (0)") > -1;
      if (matchTotal0) {
        const matchTotalNum = log.match(/\s(\d+)\s/);
        baseResult.total = matchTotalNum[1];
      }

      const matchTotal1 = log.indexOf("YSAI >[0]Total       (1)") > -1;
      if (matchTotal1) {
        const matchTotalNum = log.match(/\s(\d+)\s/);
        noteBonusResult.total = matchTotalNum[1];
      }

      const matchTotal2 = log.indexOf("YSAI >[0]Total       (2)") > -1;
      if (matchTotal2) {
        const matchTotalNum = log.match(/\s(\d+)\s/);
        vibBonusResult.total = matchTotalNum[1];
      }

      const matchTotal3 = log.indexOf("YSAI >[0]Total       (3)") > -1;
      if (matchTotal3) {
        const matchTotalNum = log.match(/\s(\d+)\s/);
        expBonusResult.total = matchTotalNum[1];
      }

      const matchNote0 = log.indexOf("YSAI  [0] Note       (0)") > -1;
      if (matchNote0) {
        const matchNoteNum = log.match(/\s(\d+)\s/);
        baseResult.note = matchNoteNum[1];
      }

      const matchNote1 = log.indexOf("YSAI  [0] Note       (1)") > -1;
      if (matchNote1) {
        const matchNoteNum = log.match(/\s(\d+)\s/);
        noteBonusResult.note = matchNoteNum[1];
      }

      const matchNote2 = log.indexOf("YSAI  [0] Note       (2)") > -1;
      if (matchNote2) {
        const matchNoteNum = log.match(/\s(\d+)\s/);
        vibBonusResult.note = matchNoteNum[1];
      }

      const matchNote3 = log.indexOf("YSAI  [0] Note       (3)") > -1;

      if (matchNote3) {
        const matchNoteNum = log.match(/\s(\d+)\s/);
        expBonusResult.note = matchNoteNum[1];
      }

      const matchVib0 = log.indexOf("YSAI  [0] VibLt      (0)") > -1;
      if (matchVib0) {
        const matchVibNum = log.match(/\s(\d+)\s/);
        baseResult.vib = matchVibNum[1];
      }

      const matchVib1 = log.indexOf("YSAI  [0] VibLt      (1)") > -1;
      if (matchVib1) {
        const matchVibNum = log.match(/\s(\d+)\s/);
        noteBonusResult.vib = matchVibNum[1];
      }

      const matchVib2 = log.indexOf("YSAI  [0] VibLt      (2)") > -1;
      if (matchVib2) {
        const matchVibNum = log.match(/\s(\d+)\s/);
        vibBonusResult.vib = matchVibNum[1];
      }

      const matchVib3 = log.indexOf("YSAI  [0] VibLt      (3)") > -1;
      if (matchVib3) {
        const matchVibNum = log.match(/\s(\d+)\s/);
        expBonusResult.vib = matchVibNum[1];
      }

      const matchExp0 = log.indexOf("YSAI  [0] Expression (0)") > -1;
      if (matchExp0) {
        const matchExpNum = log.match(/\s(\d+)\s/);
        baseResult.exp = matchExpNum[1];
      }

      const matchExp1 = log.indexOf("YSAI  [0] Expression (1)") > -1;
      if (matchExp1) {
        const matchExpNum = log.match(/\s(\d+)\s/);
        noteBonusResult.exp = matchExpNum[1];
      }

      const matchExp2 = log.indexOf("YSAI  [0] Expression (2)") > -1;
      if (matchExp2) {
        const matchExpNum = log.match(/\s(\d+)\s/);
        vibBonusResult.exp = matchExpNum[1];
      }

      const matchExp3 = log.indexOf("YSAI  [0] Expression (3)") > -1;
      if (matchExp3) {
        const matchExpNum = log.match(/\s(\d+)\s/);
        expBonusResult.exp = matchExpNum[1];
      }

      const matchRythm0 = log.indexOf("YSAI  [0] Rythm      (0)") > -1;
      if (matchRythm0) {
        const matchRythmNum = log.match(/\s(\d+)\s/);
        baseResult.rythm = matchRythmNum[1];
      }

      const matchRythm1 = log.indexOf("YSAI  [0] Rythm      (1)") > -1;
      if (matchRythm1) {
        const matchRythmNum = log.match(/\s(\d+)\s/);
        noteBonusResult.rythm = matchRythmNum[1];
      }

      const matchRythm2 = log.indexOf("YSAI  [0] Rythm      (2)") > -1;
      if (matchRythm2) {
        const matchRythmNum = log.match(/\s(\d+)\s/);
        vibBonusResult.rythm = matchRythmNum[1];
      }

      const matchRythm3 = log.indexOf("YSAI  [0] Rythm      (3)") > -1;
      if (matchRythm3) {
        const matchRythmNum = log.match(/\s(\d+)\s/);
        expBonusResult.rythm = matchRythmNum[1];
      }

      const matchStability0 = log.indexOf("YSAI  [0] Stability  (0)") > -1;
      if (matchStability0) {
        const matchStabilityNum = log.match(/\s(\d+)\s/);
        baseResult.stability = matchStabilityNum[1];
      }

      const matchStability1 = log.indexOf("YSAI  [0] Stability  (1)") > -1;
      if (matchStability1) {
        const matchStabilityNum = log.match(/\s(\d+)\s/);
        noteBonusResult.stability = matchStabilityNum[1];
      }

      const matchStability2 = log.indexOf("YSAI  [0] Stability  (2)") > -1;
      if (matchStability2) {
        const matchStabilityNum = log.match(/\s(\d+)\s/);
        vibBonusResult.stability = matchStabilityNum[1];
      }

      const matchStability3 = log.indexOf("YSAI  [0] Stability  (3)") > -1;
      if (matchStability3) {
        const matchStabilityNum = log.match(/\s(\d+)\s/);
        expBonusResult.stability = matchStabilityNum[1];
      }

      //  ここから共通データ
      const matchFurue = log.indexOf("YSAI  [0] Furue") > -1;
      if (matchFurue) {
        const matchFurueNum = log.match(/\s(\d+)\s/);
        commonData.furue = matchFurueNum[1];
      }

      const matchVibRank = log.indexOf("YSAI  [0] VibRank") > -1;
      if (matchVibRank) {
        const matchVibRankNum = log.match(/\s(\d+)\s/);
        commonData.vibRank = matchVibRankNum[1];
      }

      //YSAI  [0] Hibiki
      const matchHibiki = log.indexOf("YSAI  [0] Hibiki") > -1;
      if (matchHibiki) {
        const matchHibikiNum = log.match(/\s(\d+)\s/);
        commonData.hibiki = matchHibikiNum[1];
      }

      //YSAI >[0] Emotion

      const matchEmotion = log.indexOf("YSAI >[0] Emotion") > -1;
      if (matchEmotion) {
        const matchEmotionNum = log.match(/\s(\d+)\s/);
        commonData.emotion = matchEmotionNum[1];
      }

      // YSAI  [0] EmoInjustice
      const matchEmoInjustice = log.indexOf("YSAI  [0] EmoInjustice") > -1;
      if (matchEmoInjustice) {
        const matchEmoInjusticeNum = log.match(/\s(\d+)\s/);
        commonData.emoInjustice = matchEmoInjusticeNum[1];
      }

      // YSAI >[0] Timing
      const matchTiming = log.indexOf("YSAI >[0] Timing") > -1;
      if (matchTiming) {
        const matchTimingNum = log.match(/\s(\d+)\s/);
        let timing = matchTimingNum[1];
        // timingが 100000以上の場合、符号付き整数を誤って符号なしとして扱っている値になっているので、治す
        if (timing >= 100000) {
          timing = timing - 4294967296;
        }
        commonData.timing = timing;

        let expectedRythm = 100000;
        if (timing < 0) {
          expectedRythm += 10 * timing;
        } else {
          expectedRythm -= 155.56 * timing;
        }
        expectedRythm = Math.floor(expectedRythm);
        commonData.expectedRythm = expectedRythm;
      }

      //YSAI  [0] Longtone
      const matchLongtone = log.indexOf("YSAI  [0] Longtone") > -1;
      if (matchLongtone) {
        const matchLongtoneNum = log.match(/\s(\d+)\s/);
        commonData.longtone = matchLongtoneNum[1];
      }

      // YSAI  [0] Scoop
      const matchScoop = log.indexOf("YSAI  [0] Scoop") > -1;
      if (matchScoop) {
        const matchScoopNum = log.match(/\s(\d+)\s/);
        commonData.scoop = matchScoopNum[1];
      }

      // YSAI  [0] Kobushi
      const matchKobushi = log.indexOf("YSAI  [0] Kobushi") > -1;
      if (matchKobushi) {
        const matchKobushiNum = log.match(/\s(\d+)\s/);
        commonData.kobushi = matchKobushiNum[1];
      }

      // YSAI  [0] Fall
      const matchFall = log.indexOf("YSAI  [0] Fall") > -1;
      if (matchFall) {
        const matchFallNum = log.match(/\s(\d+)\s/);
        commonData.fall = matchFallNum[1];
      }
    }

    returnObj.baseResult = baseResult;
    returnObj.noteBonusResult = noteBonusResult;
    returnObj.vibBonusResult = vibBonusResult;
    returnObj.expBonusResult = expBonusResult;
    returnObj.commonData = commonData;

    session.result = returnObj;
  });

  songSessions.forEach((session, index) => {
    //
    console.log(`\n-------\nSession ${index + 1}`);
    if (session.result.songId) {
      console.log(`Song: ${songs.get(session.result.songId).SongName}`);
      console.log(`Singer: ${songs.get(session.result.songId).SingerName}`);
    }

    // 総合点は、最も高い点数を採用する
    let total = 0;
    let totalList = [];
    totalList.push(session.result.baseResult.total);
    totalList.push(session.result.noteBonusResult.total);
    totalList.push(session.result.vibBonusResult.total);
    totalList.push(session.result.expBonusResult.total);

    total = Math.max(...totalList);

    console.log(`総合: ${total}`);
    console.log(`素点: ${session.result.baseResult.total}`);
    console.log(`ボーナス: ${total - session.result.baseResult.total}`);

    // どの点数を採用したか
    let totalIndex = totalList.indexOf(total + "");
    if (totalIndex == 0) {
      console.log("素点");
    } else if (totalIndex == 1) {
      console.log("音程ボーナス");
    } else if (totalIndex == 2) {
      console.log("ビブラートボーナス");
    } else if (totalIndex == 3) {
      console.log("表現力ボーナス");
    }

    console.log();

    const results = [
      session.result.baseResult,
      session.result.noteBonusResult,
      session.result.vibBonusResult,
      session.result.expBonusResult,
    ];

    console.log(`音程:${results[totalIndex].note}`);
    console.log(`VL:${results[totalIndex].vib}`);
    console.log(`表現力:${results[totalIndex].exp}`);
    console.log(`リズム:${results[totalIndex].rythm}`);
    console.log(`安定性:${results[totalIndex].stability}`);

    console.log("\n純正のチャート");
    console.log(`音程:${session.result.baseResult.note}`);
    console.log(`VL:${session.result.baseResult.vib}`);
    console.log(`表現力:${session.result.baseResult.exp}`);
    console.log(`リズム:${session.result.baseResult.rythm}`);
    console.log(`安定性:${session.result.baseResult.stability}`);

    console.log();

    console.log(`ビブ:${session.result.commonData.vibRank}`);
    console.log(`ロング:${session.result.commonData.longtone}`);

    console.log(`Timing(+は走り):${session.result.commonData.timing}`);
    // console.log(`Timingから推定されるリズム値:${session.result.commonData.expectedRythm}`);

    console.log(`抑揚(1000満点):${session.result.commonData.emotion}`);
    console.log(`hibiki(裏加点):${session.result.commonData.hibiki}`);
    console.log(`hurue(安定性の親の値):${session.result.commonData.furue}`);
    console.log(`抑揚不正:${session.result.commonData.emoInjustice}`);
    console.log(`しゃくり:${session.result.commonData.scoop}`);
    console.log(`こぶし:${session.result.commonData.kobushi}`);
    console.log(`フォール:${session.result.commonData.fall}`);
  });
});
