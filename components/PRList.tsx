import type { PersonPRs } from "@/lib/queries";
import PersonCard from "./PersonCard";

interface Props {
  persons: PersonPRs[];
}

export default function PRList({ persons }: Props) {
  return (
    <div className="space-y-4">
      {persons.map((person) => (
        <PersonCard key={person.personId} person={person} />
      ))}
    </div>
  );
}
