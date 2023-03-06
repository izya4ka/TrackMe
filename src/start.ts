import { Message } from "node-telegram-bot-api";
import { Track, User } from "./models";
import { MongoClient } from "mongodb";
import TelegramBot from "node-telegram-bot-api";

console.log("[#] Started");

const config = require("../bot-config.json");

const db_client = new MongoClient(config.mongodb_url);
const db = db_client.db(config.db_name);
const users = db.collection<User>(config.users_collection);

const bot = new TelegramBot(config.token, { polling: true });

console.log("[#] Bot started");

bot.onText(/\/start/, (msg: Message) => {
  const chat_id = msg.chat.id;
  const user_id = msg.from?.id || 0;
  users.findOne({ id: user_id }).then((user) => {
    if (user?.id == user_id) console.log("User already registered");
    else {
      users.insertOne({
        id: user_id,
        tracks: [],
        settings: { language: "ru" },
        states: { addTrack: false, setLang: false },
      });
      console.log("user registered");
    }
    bot.sendMessage(chat_id, "Выберите опцию", {
      reply_markup: {
        keyboard: [
          [{ text: "Список треков" }, { text: "Добавить треки" }],
          [{ text: "Настройки" }],
        ],
      },
    });
  });
});

bot.onText(/Список треков/, (msg: Message) => {
  const opts = {
    id: msg.from?.id,
    chat_id: msg.chat.id,
  };
  users.findOne({ id: opts.id }).then((user) => {
    const tracks = user?.tracks;
    if (tracks?.length === 0)
      bot.sendMessage(
        opts.chat_id,
        "Треки не найдены!\nДобавьте, нажав кнопку 'Добавить треки'"
      );
    else {
      tracks?.forEach((track) => {
        bot.sendMessage(
          opts.chat_id,
          `${track.name}\n${track.track}\nДобавлен: ${track.added}`
        );
      });
    }
  });
});

bot.onText(/Добавить треки/, (msg: Message) => {
  const opts = {
    id: msg.from?.id,
    chat_id: msg.chat.id,
  };
  users.updateOne(
    { id: opts.id },
    { $set: { states: { setLang: false, addTrack: true } } }
  );
  users.findOne({ id: opts.id }).then((user) => {
      bot.sendMessage(
        opts.chat_id,
        "Добавьте треки, перечислив каждый с новой строчки",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "Отмена", callback_data: "cancel" }]],
          },
        }
      );
  });
});

bot.on("callback_query", (query) => {
  const opts = {
    chat_id: query.message?.chat.id || 0,
    id: query.from.id,
  };

  if (query.data === "cancel") {
    console.log(opts.id)
    users.updateOne(
      { id: opts.id },
      { $set: { states: { setLang: false, addTrack: false } } }
    );
    bot.answerCallbackQuery(query.id, { text: "Отмена ввода трека" });
  }
});

bot.onText(/^\S{14}$/mg, (msg) => {
  const opts = {
    chat_id: msg.chat.id,
    id: msg.from?.id,
  };
  const received_tracks = msg.text?.split("\n") || [];
  const tracks_checking = received_tracks.map((track) => {
    if (track.length >= 13 && track.length <= 14)
      return 1;
    else return 0;
  });
  console.log(tracks_checking);
  const valid_tracks: string[] = [];
  for (let i = 0; i < tracks_checking.length; i++) {
    if (tracks_checking[i] == 1) valid_tracks.push(received_tracks[i]);
  }
  console.log(valid_tracks);
  users.findOne({ id: opts.id }).then((user) => {
    if (user?.states.addTrack) {
      if (valid_tracks.length != 0) {
        const existed_tracks = user?.tracks || [];
        const processed_tracks = valid_tracks?.map<Track>((track) => {
          return { name: "default", track: track, added: new Date() };
        });
        users.updateOne(
          { id: opts.id },
          {
            $set: {
              tracks: [...existed_tracks, ...processed_tracks],
              states: { addTrack: false, setLang: false },
            },
          }
        );
        let message: string = "Итого:\n";
        for (let i = 0; i < tracks_checking.length; i++) {
          if (tracks_checking[i] == 1) {
            message += `[✓] Трек "${received_tracks[i]}"\n`;
          } else {
            message += `[⛌] Трек "${received_tracks[i]}"\n`;
          }
        }
        message += "✓ - трек внесён в БД\nX - трек не верен/не найден";
        bot.sendMessage(opts.chat_id, message);
      } else {
        bot.sendMessage(opts.chat_id, "Треки не верны\nПопробуйте ещё раз");
      }
    }
  });
});
