import { useParams } from "react-router-dom"

export default function Exercise() {

  const { id } = useParams()

  return (
    <div>
      <h1>Exercise: {id}</h1>
      <p>Instructions will go here.</p>
    </div>
  )
}