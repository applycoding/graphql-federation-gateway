import { signToken } from './auth/jwt';
import { demoUsers } from './users/data';

const userId = process.argv[2] ?? 'user_ada';
const user = demoUsers.find((candidate) => candidate.id === userId);

if (!user) {
  console.error(`Unknown demo user "${userId}". Known ids: ${demoUsers.map((candidate) => candidate.id).join(', ')}`);
  process.exit(1);
}

console.log(signToken({ id: user.id, role: user.role }));
