<template>
    <h1>Redireccionando...</h1>
</template>
<script>

export default {
    data (){
        return{
            username:'',
            password:'',
            error: {
                status: null,
                message: ""
            }
        }
    },
    created(){
        this.$router.push('/');
    }
}
</script>