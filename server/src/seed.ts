import 'dotenv/config';
import mongoose from 'mongoose';
import { CategoryModel } from './models';

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lan_party_trivia';

async function seed() {
await mongoose.connect(uri);
await CategoryModel.deleteMany({});
await CategoryModel.create({
  title: 'Kitchen Table Science',
  order: 0,
  questions: [
    { value: 100, question: 'This gas makes up most of Earth\'s atmosphere.', answer: 'Nitrogen' },
    { value: 200, question: 'The boiling point of water in Celsius at sea level.', answer: '100 degrees' },
    { value: 300, question: 'The force that keeps your feet on the floor.', answer: 'Gravity' },
    { value: 400, question: 'This organ pumps blood around the body.', answer: 'The heart', dailyDouble: true },
    { value: 500, question: 'The only metal that is liquid at room temperature.', answer: 'Mercury' },
  ],
});
await CategoryModel.create({
  title: 'Screen Time',
  order: 1,
  questions: [
    { value: 100, question: 'The wizarding school attended by Harry Potter.', answer: 'Hogwarts' },
    { value: 200, question: 'The animated toy cowboy voiced by Tom Hanks.', answer: 'Woody' },
    { value: 300, question: 'The city where Batman keeps watch.', answer: 'Gotham City' },
    { value: 400, question: 'The fictional language spoken in Wakanda.', answer: 'Xhosa' },
    { value: 500, question: 'The first feature-length animated film from Disney.', answer: 'Snow White and the Seven Dwarfs' },
  ],
});
console.log('Seeded example Jeopardy board.');
await mongoose.disconnect();
}

void seed();
