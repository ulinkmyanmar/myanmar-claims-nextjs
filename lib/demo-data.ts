export type Member = { id:string; full_name:string; nrc:string|null; date_of_birth:string|null; gender:string|null; normalized_name:string; normalized_nrc:string|null; database_version_id:string }
export type Claim = { id:string; member_id:string; claim_number:string; incurred_date:string|null; discharge_date:string|null; diagnosis_code:string|null; diagnosis_description:string|null; database_version_id:string }
export const demoMembers: Member[] = [
 {id:'HM0000001',full_name:'Yoon Thadar Htun',nrc:'12/ABC(N)123456',date_of_birth:'1918-07-11',gender:'Female',normalized_name:'yoon thadar htun',normalized_nrc:'12abcn123456',database_version_id:'VER-2026-JUN'},
 {id:'HM0000002',full_name:'Aung Min Khant',nrc:'9/MABANA(N)765432',date_of_birth:'1987-03-22',gender:'Male',normalized_name:'aung min khant',normalized_nrc:'9mabanan765432',database_version_id:'VER-2026-JUN'},
 {id:'HM0000003',full_name:'Mya Sandar Win',nrc:'5/KALANA(N)222111',date_of_birth:'1992-12-04',gender:'Female',normalized_name:'mya sandar win',normalized_nrc:'5kalanan222111',database_version_id:'VER-2026-JUN'}]
export const demoClaims: Claim[] = [
 {id:'C1',member_id:'HM0000001',claim_number:'2311170001',incurred_date:'2023-11-17',discharge_date:'2023-11-17',diagnosis_code:'R50.9',diagnosis_description:'Fever, unspecified',database_version_id:'VER-2026-JUN'},
 {id:'C2',member_id:'HM0000001',claim_number:'2410010033',incurred_date:'2024-09-27',discharge_date:'2024-09-27',diagnosis_code:'Z01.2',diagnosis_description:'Encounter for dental examination and cleaning',database_version_id:'VER-2026-JUN'},
 {id:'C3',member_id:'HM0000002',claim_number:'2403220155',incurred_date:'2024-03-22',discharge_date:'2024-03-25',diagnosis_code:'J06.9',diagnosis_description:'Acute upper respiratory infection',database_version_id:'VER-2026-JUN'}]
