import { Link } from "react-router-dom"

export default function ExerciseList() {

  const exercises = [
    { id: "sum", title: "Sum Two Numbers" },
    { id: "fizzbuzz", title: "FizzBuzz" }
  ]

  return (
    <div>
      <h1>Exercises</h1>

      {exercises.map(ex => (
        <div key={ex.id}>
          <Link to={`/exercises/${ex.id}`}>
            {ex.title}
          </Link>
        </div>
      ))}
    </div>
  )
}