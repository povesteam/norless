// Invites a person, e.g. the first owner: npm run invite -- pavel@example.com owner
import { migrate, openDatabase } from "../db/db.js";
import { invite, type Role, roles } from "../auth/members.js";

const [email, ...wanted] = process.argv.slice(2);
if (!email?.includes("@") || wanted.length === 0) {
  console.error(`Usage: npm run invite -- <email> <${roles.join("|")}>…`);
  process.exit(1);
}
const unknown = wanted.filter((r) => !(roles as readonly string[]).includes(r));
if (unknown.length > 0) {
  console.error(
    `Unknown roles: ${unknown.join(", ")}. Roles: ${roles.join(", ")}`,
  );
  process.exit(1);
}

const db = openDatabase();
migrate(db);
// ponytail: v1 has one community; pass its slug once there are several (v3).
const communities = db
  .prepare("SELECT id, name FROM communities WHERE deleted_at IS NULL")
  .all() as { id: string; name: string }[];
const [community] = communities;
if (!community || communities.length > 1) {
  console.error(`Expected one community, found ${communities.length}.`);
  process.exit(1);
}
invite(db, community.id, email, wanted as Role[]);
db.close();
console.log(`Invited ${email} to ${community.name} as ${wanted.join(", ")}.`);
