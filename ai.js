const fs = require("fs");

function getTechName(techId) {
  // 上のコメントを元に、各技の名前を返す
  switch (techId) {
    case 0:
      return "しゃくり";
    case 10:
      return "こぶし(先頭)";
    case 0xb:
      return "こぶし(中間)";
    case 0x12:
      return "フォール";
    case 0x21:
      return "ビブラート33";
    case 0x22:
      return "ビブラート34";
    case 0x23:
      return "ビブラート35";
    case 0x24:
      return "ビブラート36";
    case 0x25:
      return "ビブラート37";
    case 0x26:
      return "ビブラート38";
    case 1:
      return "大しゃくり";
    case 2:
      return "早いしゃくり";
    case 3:
      return "早いしゃくり(強)";
    case 4:
      return "L字アクセント";
    case 5:
      return "L字アクセント(強)";
    case 9:
      return "逆V字アクセント";
    case 0xc:
      return "フライダウン";
    case 6:
      return "V字アクセント";
    case 7:
      return "V字アクセント(谷切れ)";
    case 8:
      return "V字アクセント(下から)";
    case 0xd:
      return "ハンマリング・オン";
    case 0xe:
      return "プリング・オフ";
    case 0x16:
      return "スロウダウン";
    case 0xf:
      return "上昇ポルタメント";
    case 0x10:
      return "下降ポルタメント";
    case 0x17:
      return "スライダー";
    case 0x18:
      return "水平";
    case 0x19:
      return "スタッカート";
    case 0x1a:
      return "U形";
    case 0x1b:
      return "逆U形";
    case 0x1c:
      return "への字形";
    case 0x1d:
      return "アーチ形";
    case 0x1e:
      return "特殊ビブラート30";
    case 0x1f:
      return "特殊ビブラート31";
    case 0x20:
      return "特殊ビブラート32";
    case 0x27:
      return "ジャストヒット";
    case 0x2b:
      return "歌い回しなし";
    case 0x13:
      return "早いフォール";
    case 0x14:
      return "ヒーカップ";
    case 0x15:
      return "フォール付きヒーカップ";
    case 0x28:
      return "エッジボイス";
    case 0x29:
      return "フォールエッジ";
    case 0x2a:
      return "逆こぶし";
    default:
      return "不明な技";
  }
}

// ログを解析してMapに登録する関数
function parseLogs(logData) {
  const logMap = new Map();

  // ログを行ごとに分割
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
    const startMatch = line.match(/SEIMITSU CDioKaraokeApp::OnOpen/);
    if (startMatch) {
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
    const endMatch = line.match(/SEIMITSU CDioKaraokeApp::OnClose/);
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
    let techCounts = {};

    let lastLine = "";
    session.logs.forEach((log) => {
      const matchName = log.match(/SEIMITSU RQNO: (\d{4}-\d{2})/);
      if (matchName) {
        session.req = matchName[1];
      }

      const techMatch = log.match(/SEIMITSU detected .*? tech (\d+)/);
      if (techMatch) {
        const techId = techMatch[1];
        const techName = getTechName(techId * 1);
        techCounts[techName] = (techCounts[techName] || 0) + 1;
      }

      const combinedLog = [lastLine, log].join(" ");

      // 正規表現でDIO, SPR, Bonusの値を抽出
      const match = combinedLog.match(
        /DIO\s*=\s*(\d+), SPR\s*=\s*(\d+), Bonus\s*=\s*(\d+)/
      );
      const floatMatch = combinedLog.match(/(\d+\.\d+),\s*(\d+\.\d+)\]/);
      if (match) {
        session.scores = [match[1], match[2], match[3]].map(Number);
      }
      if (floatMatch) {
        session.floatScores = [floatMatch[1], floatMatch[2]].map(Number);
      }
    });
    session.techCounts = techCounts;
  });

  songSessions.forEach((session, index) => {
    console.log(`Session ${index + 1}`);
    console.log(`Song: ${songs.get(session.req).SongName}`);
    console.log(`Singer: ${songs.get(session.req).SingerName}`);
    if (session.scores) {
      console.log(
        `DIO: ${session.scores[0]}, SPR: ${session.scores[1]}, Bonus: ${session.scores[2]}`
      );
      console.log(
        `Ai感性: ${session.floatScores[0]}, ${session.floatScores[1]}`
      );
      console.log(session.techCounts);
      console.log("---");
    }
  });
});
