"use client"

import {useState} from "react"

type Claim = {
  id:number
  claim_no:string
  client_name:string
  claim_status:string
}

export default function DashboardSearch(){

const [keyword,setKeyword]=useState("")
const [results,setResults]=useState<Claim[]>([])


async function search(){

const res = await fetch(
 `/api/claims/search?q=${keyword}`
)

const data = await res.json()

setResults(data)

}


return (
<div>

<input
value={keyword}
onChange={(e)=>setKeyword(e.target.value)}
/>

<button onClick={search}>
Search
</button>


<table>

<tbody>

{results.map(item=>(

<tr key={item.id}>
<td>{item.claim_no}</td>
<td>{item.client_name}</td>
<td>{item.claim_status}</td>
</tr>

))}

</tbody>

</table>

</div>
)

}